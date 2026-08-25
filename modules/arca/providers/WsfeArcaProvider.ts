import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { ARCA_ENDPOINTS } from "../endpoints";
import {
  ArcaAuthenticationError,
  ArcaConfigurationError,
  ArcaRejectedInvoiceError,
} from "../errors";
import { escapeXml, soapCall, tag, tags } from "../soap";
import { createTra } from "../wsaa/create-tra";
import { signTra } from "../wsaa/sign-tra";
import type {
  ArcaEnvironment,
  ArcaInvoiceProvider,
  ArcaInvoiceRequest,
  ArcaInvoiceResult,
  ArcaLastVoucherInfo,
  ArcaVoucherType,
} from "../types";

const voucherCodes: Record<ArcaVoucherType, number> = {
  FACTURA_A: 1,
  FACTURA_B: 6,
  FACTURA_C: 11,
  NOTA_CREDITO_A: 3,
  NOTA_CREDITO_B: 8,
  NOTA_DEBITO_A: 2,
  NOTA_DEBITO_B: 7,
};
const documentCodes: Record<string, number> = {
  CUIT: 80,
  DNI: 96,
  CONSUMIDOR_FINAL: 99,
};
const authXml = (ticket: { token: string; sign: string }, cuit: string) =>
  `<Auth><Token>${escapeXml(ticket.token)}</Token><Sign>${escapeXml(ticket.sign)}</Sign><Cuit>${escapeXml(cuit)}</Cuit></Auth>`;
const envelope = (operation: string, content: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${operation} xmlns="http://ar.gov.afip.dif.FEV1/">${content}</${operation}></soap:Body></soap:Envelope>`;

export class WsfeArcaProvider implements ArcaInvoiceProvider {
  constructor(
    private environment: ArcaEnvironment,
    private cuit: string,
    private certificate: string,
    private privateKey: string,
    private service = "wsfe",
  ) {
    if (
      environment === "PRODUCCION" &&
      process.env.ARCA_PRODUCTION_ENABLED !== "true"
    )
      throw new ArcaConfigurationError(
        "La emisión ARCA en producción está bloqueada por Vase.",
      );
  }
  getEnvironment() {
    return this.environment;
  }
  private async ticket() {
    const now = new Date(),
      cached = await prisma.arcaAccessTicket.findUnique({
        where: {
          environment_cuit_service: {
            environment: this.environment,
            cuit: this.cuit,
            service: this.service,
          },
        },
      });
    if (cached && cached.expirationTime.getTime() - now.getTime() > 5 * 60_000)
      return {
        token: decryptSecret(cached.tokenEncrypted),
        sign: decryptSecret(cached.signEncrypted),
        generationTime: cached.generationTime,
        expirationTime: cached.expirationTime,
      };
    const tra = createTra(this.service, now),
      cms = await signTra(tra, this.certificate, this.privateKey);
    const request = `<?xml version="1.0" encoding="utf-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><loginCms xmlns="https://wsaa.view.sua.dvadac.desein.afip.gov"><in0>${cms}</in0></loginCms></soapenv:Body></soapenv:Envelope>`;
    const response = await soapCall(
      ARCA_ENDPOINTS[this.environment].wsaa,
      "",
      request,
    );
    const ticketXml = (tag(response, "loginCmsReturn") ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    const token = tag(ticketXml, "token"),
      sign = tag(ticketXml, "sign"),
      generation = tag(ticketXml, "generationTime"),
      expiration = tag(ticketXml, "expirationTime");
    if (!token || !sign || !generation || !expiration)
      throw new ArcaAuthenticationError(
        tag(response, "faultstring") ??
          "WSAA no devolvió un Ticket de Acceso válido.",
      );
    const data = {
      tokenEncrypted: encryptSecret(token),
      signEncrypted: encryptSecret(sign),
      generationTime: new Date(generation),
      expirationTime: new Date(expiration),
    };
    await prisma.arcaAccessTicket.upsert({
      where: {
        environment_cuit_service: {
          environment: this.environment,
          cuit: this.cuit,
          service: this.service,
        },
      },
      update: data,
      create: {
        environment: this.environment,
        cuit: this.cuit,
        service: this.service,
        ...data,
      },
    });
    return {
      token,
      sign,
      generationTime: data.generationTime,
      expirationTime: data.expirationTime,
    };
  }
  async testAuthentication() {
    const t = await this.ticket();
    return {
      generationTime: t.generationTime,
      expirationTime: t.expirationTime,
      service: this.service,
    };
  }
  async getLastAuthorizedVoucher(
    puntoVenta: number,
    voucherType: ArcaVoucherType,
  ): Promise<ArcaLastVoucherInfo> {
    const ticket = await this.ticket(),
      code = voucherCodes[voucherType];
    const response = await soapCall(
      ARCA_ENDPOINTS[this.environment].wsfe,
      "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
      envelope(
        "FECompUltimoAutorizado",
        `${authXml(ticket, this.cuit)}<PtoVta>${puntoVenta}</PtoVta><CbteTipo>${code}</CbteTipo>`,
      ),
    );
    const last = tag(response, "CbteNro");
    if (last === null)
      throw new ArcaAuthenticationError(
        tag(response, "ErrMsg") ?? "WSFEv1 no devolvió el último comprobante.",
      );
    return { puntoVenta, voucherType, ultimoNumeroAutorizado: Number(last) };
  }
  async checkWsfe() {
    await this.getLastAuthorizedVoucher(1, "FACTURA_A");
    return true;
  }
  async authorizeInvoice(
    request: ArcaInvoiceRequest,
  ): Promise<ArcaInvoiceResult> {
    const ticket = await this.ticket(),
      voucherCode = voucherCodes[request.voucherType],
      number =
        (
          await this.getLastAuthorizedVoucher(
            request.puntoVenta,
            request.voucherType,
          )
        ).ultimoNumeroAutorizado + 1;
    const date = request.fecha.replaceAll("-", "").slice(0, 8),
      docCode = documentCodes[request.clienteDocTipo];
    const content = `${authXml(ticket, request.cuitEmisor)}<FeCAEReq><FeCabReq><CantReg>1</CantReg><PtoVta>${request.puntoVenta}</PtoVta><CbteTipo>${voucherCode}</CbteTipo></FeCabReq><FeDetReq><FECAEDetRequest><Concepto>${request.conceptos === "PRODUCTOS" ? 1 : request.conceptos === "SERVICIOS" ? 2 : 3}</Concepto><DocTipo>${docCode}</DocTipo><DocNro>${escapeXml(request.clienteDocNumero)}</DocNro><CbteDesde>${number}</CbteDesde><CbteHasta>${number}</CbteHasta><CbteFch>${date}</CbteFch><ImpTotal>${request.importeTotal.toFixed(2)}</ImpTotal><ImpTotConc>0</ImpTotConc><ImpNeto>${request.importeNeto.toFixed(2)}</ImpNeto><ImpOpEx>0</ImpOpEx><ImpTrib>${request.importeTributos.toFixed(2)}</ImpTrib><ImpIVA>${request.importeIva.toFixed(2)}</ImpIVA><MonId>${request.moneda}</MonId><MonCotiz>${request.cotizacionMoneda.toFixed(6)}</MonCotiz><Iva><AlicIva><Id>5</Id><BaseImp>${request.importeNeto.toFixed(2)}</BaseImp><Importe>${request.importeIva.toFixed(2)}</Importe></AlicIva></Iva></FECAEDetRequest></FeDetReq></FeCAEReq>`;
    const response = await soapCall(
      ARCA_ENDPOINTS[this.environment].wsfe,
      "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
      envelope("FECAESolicitar", content),
    );
    const cae = tag(response, "CAE"),
      vencimiento = tag(response, "CAEFchVto"),
      resultado = tag(response, "Resultado"),
      errores = tags(response, "Err").map((raw) => ({
        codigo: tag(raw, "Code") ?? "ARCA",
        mensaje: tag(raw, "Msg") ?? raw,
      }));
    const observations = tags(response, "Obs").map((raw) => ({
      codigo: tag(raw, "Code") ?? "ARCA",
      mensaje: tag(raw, "Msg") ?? raw,
    }));
    if (resultado !== "A" || !cae)
      return {
        ok: false,
        cae: null,
        vencimientoCae: null,
        numeroComprobante: number,
        estado: "RECHAZADA",
        errores,
        observaciones: observations,
        requestRaw: { ...request, numero: number },
        responseRaw: response,
      };
    return {
      ok: true,
      cae,
      vencimientoCae: vencimiento
        ? `${vencimiento.slice(0, 4)}-${vencimiento.slice(4, 6)}-${vencimiento.slice(6, 8)}`
        : null,
      numeroComprobante: number,
      estado: "AUTORIZADA",
      errores,
      observaciones: observations,
      requestRaw: { ...request, numero: number },
      responseRaw: response,
    };
  }
  async getVoucher(
    puntoVenta: number,
    voucherType: ArcaVoucherType,
    number: number,
  ) {
    const ticket = await this.ticket();
    const response = await soapCall(
      ARCA_ENDPOINTS[this.environment].wsfe,
      "http://ar.gov.afip.dif.FEV1/FECompConsultar",
      envelope(
        "FECompConsultar",
        `${authXml(ticket, this.cuit)}<FeCompConsReq><CbteTipo>${voucherCodes[voucherType]}</CbteTipo><CbteNro>${number}</CbteNro><PtoVta>${puntoVenta}</PtoVta></FeCompConsReq>`,
      ),
    );
    return response;
  }
}
