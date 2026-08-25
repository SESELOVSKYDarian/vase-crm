import type {
  ArcaInvoiceProvider,
  ArcaInvoiceRequest,
  ArcaInvoiceResult,
  ArcaLastVoucherInfo,
  ArcaEnvironment,
  ArcaVoucherType,
} from "../types";
import { requiresAssociatedVoucher } from "../vouchers";

/**
 * Implementación de referencia / demo de ArcaInvoiceProvider.
 *
 * IMPORTANTE: esta clase NO se conecta a los Web Services reales de ARCA.
 * Simula el comportamiento esperado (numeración correlativa, CAE,
 * vencimiento a 10 días, idempotencia) para que el resto del sistema
 * (facturación, cuenta corriente, PDF) pueda desarrollarse y testearse
 * de punta a punta sin depender de certificados reales.
 *
 * Para producción: reemplazar por una clase que implemente el mismo
 * contrato `ArcaInvoiceProvider` usando WSAA (autenticación con
 * certificado digital, caché/renovación del Ticket de Acceso) y
 * WSFEv1 (o WSMTXCA según corresponda) sobre SOAP/XML.
 */
export class MockArcaProvider implements ArcaInvoiceProvider {
  private environment: ArcaEnvironment;
  private lastVoucherByKey = new Map<string, number>();
  private processedIdempotencyKeys = new Map<string, ArcaInvoiceResult>();

  constructor(environment: ArcaEnvironment = "HOMOLOGACION") {
    this.environment = environment;
  }

  getEnvironment(): ArcaEnvironment {
    return this.environment;
  }

  async getLastAuthorizedVoucher(
    puntoVenta: number,
    voucherType: ArcaVoucherType
  ): Promise<ArcaLastVoucherInfo> {
    const key = `${puntoVenta}-${voucherType}`;
    const ultimo = this.lastVoucherByKey.get(key) ?? 12844; // semilla demo
    return { puntoVenta, voucherType, ultimoNumeroAutorizado: ultimo };
  }

  async authorizeInvoice(request: ArcaInvoiceRequest): Promise<ArcaInvoiceResult> {
    // Idempotencia: una caída de red no debe generar una factura duplicada.
    const cached = this.processedIdempotencyKeys.get(request.idempotencyKey);
    if (cached) return cached;

    const validationErrors = this.validate(request);
    if (validationErrors.length > 0) {
      const result: ArcaInvoiceResult = {
        ok: false,
        cae: null,
        vencimientoCae: null,
        numeroComprobante: null,
        estado: "RECHAZADA",
        errores: validationErrors,
        observaciones: [],
        requestRaw: request,
        responseRaw: null,
      };
      this.processedIdempotencyKeys.set(request.idempotencyKey, result);
      return result;
    }

    const key = `${request.puntoVenta}-${request.voucherType}`;
    const last = this.lastVoucherByKey.get(key) ?? 12844;
    const nextNumber = last + 1;
    this.lastVoucherByKey.set(key, nextNumber);

    const cae = this.generateFakeCae();
    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + 10);

    const result: ArcaInvoiceResult = {
      ok: true,
      cae,
      vencimientoCae: vencimiento.toISOString().slice(0, 10),
      numeroComprobante: nextNumber,
      estado: "AUTORIZADA",
      errores: [],
      observaciones: [],
      requestRaw: request,
      responseRaw: {
        resultado: "A",
        cae,
        fchVto: vencimiento.toISOString().slice(0, 10),
        cbteNro: nextNumber,
        entorno: this.environment,
      },
    };
    this.processedIdempotencyKeys.set(request.idempotencyKey, result);
    return result;
  }

  private validate(request: ArcaInvoiceRequest): { codigo: string; mensaje: string }[] {
    const errors: { codigo: string; mensaje: string }[] = [];
    if (!request.cuitEmisor) errors.push({ codigo: "10015", mensaje: "CUIT del emisor inválido" });
    if (request.importeTotal <= 0) errors.push({ codigo: "10063", mensaje: "El importe total debe ser mayor a cero" });
    const calc = Math.round((request.importeNeto + request.importeIva + request.importeTributos) * 100) / 100;
    if (Math.round(request.importeTotal * 100) / 100 !== calc) {
      errors.push({ codigo: "10071", mensaje: "El importe total no coincide con neto + IVA + tributos" });
    }
    if (request.voucherType === "FACTURA_A" && request.clienteDocTipo !== "CUIT") {
      errors.push({ codigo: "10108", mensaje: "Factura A requiere CUIT del receptor" });
    }
    if (requiresAssociatedVoucher(request.voucherType) && !request.associatedVoucher) {
      errors.push({ codigo: "10040", mensaje: "La nota requiere un comprobante asociado" });
    }
    return errors;
  }

  private generateFakeCae(): string {
    const digits = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
    return digits;
  }
}

export const arcaProvider = new MockArcaProvider(
  (process.env.ARCA_ENVIRONMENT as ArcaEnvironment) ?? "HOMOLOGACION"
);
