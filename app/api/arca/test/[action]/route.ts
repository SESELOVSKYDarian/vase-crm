import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getArcaProvider } from "@/modules/arca/server";
import { isValidCuit } from "@/lib/arca/cuit";
import {
  assertCertificateMatchesPrivateKey,
  validateCertificatePem,
  validatePrivateKeyPem,
} from "@/lib/arca/certificate";
import { decryptSecret } from "@/lib/security/encryption";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/csrf";

const requestSchema = z.object({
  puntoVenta: z.coerce.number().int().positive().optional(),
  voucherType: z.enum(["FACTURA_A", "FACTURA_B", "FACTURA_C"]).optional(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  let user: any;
  const started = Date.now();
  const action = (await params).action;
  try {
    assertSameOrigin(request);
    user = await requirePermission("arca.connection.test");
    const input = requestSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!input.success)
      return NextResponse.json(
        { error: "Parámetros inválidos." },
        { status: 400 },
      );
    const settings = await prisma.companySettings.findFirst();
    if (!settings) throw new Error("Configuración ARCA inexistente.");
    const certificate = settings.arcaCertificate
        ? decryptSecret(settings.arcaCertificate)
        : "",
      key = settings.arcaPrivateKey
        ? decryptSecret(settings.arcaPrivateKey)
        : "";
    const checks = () => {
      const metadata = validateCertificatePem(certificate);
      validatePrivateKeyPem(key);
      assertCertificateMatchesPrivateKey(certificate, key);
      if (!settings.arcaCuit || !isValidCuit(settings.arcaCuit))
        throw new Error("CUIT ARCA inválido.");
      if (!settings.arcaPuntoVenta)
        throw new Error("Punto de venta ARCA inválido.");
      return metadata;
    };
    let data: any;
    if (action === "credentials") {
      const metadata = checks();
      data = {
        checks: [
          "Certificado válido",
          "Clave privada válida",
          "Certificado y clave coinciden",
          "CUIT válido",
          "Punto de venta configurado",
        ],
        certificate: metadata,
      };
    } else {
      checks();
      const { provider, settings: persisted } = await getArcaProvider();
      if (action === "wsaa") {
        const ticket = await provider.testAuthentication();
        data = {
          service: ticket.service,
          generatedAt: ticket.generationTime,
          expiresAt: ticket.expirationTime,
        };
      } else if (action === "last-voucher" || action === "wsfe") {
        const point = input.data.puntoVenta ?? persisted.arcaPuntoVenta!,
          type = input.data.voucherType ?? "FACTURA_A";
        const last = await provider.getLastAuthorizedVoucher(point, type);
        data =
          action === "last-voucher"
            ? last
            : { server: persisted.arcaEnvironment, lastVoucher: last };
      } else if (action === "full") {
        const ticket = await provider.testAuthentication();
        const last = await provider.getLastAuthorizedVoucher(
          persisted.arcaPuntoVenta!,
          "FACTURA_A",
        );
        data = {
          checks: [
            "Configuración",
            "Certificado X.509",
            "Clave privada",
            "Coincidencia cert/key",
            "WSAA",
            "Ticket de acceso",
            "WSFEv1",
            "Punto de venta",
          ],
          ticket: {
            generatedAt: ticket.generationTime,
            expiresAt: ticket.expirationTime,
          },
          lastVoucher: last,
        };
      } else
        return NextResponse.json(
          { error: "Prueba ARCA desconocida." },
          { status: 404 },
        );
    }
    const durationMs = Date.now() - started;
    await prisma.arcaConnectionTest.create({
      data: {
        userId: user.id,
        environment: settings.arcaEnvironment,
        testType: action,
        status: "EXITOSA",
        durationMs,
        message: "Prueba completada correctamente.",
      },
    });
    await prisma.companySettings.update({
      where: { id: settings.id },
      data: {
        arcaLastConnectionTestAt: new Date(),
        arcaLastConnectionStatus: "VERIFICADA",
        arcaLastConnectionMessage: "Conexión ARCA verificada.",
      },
    });
    await writeAudit(
      user.id,
      "ARCA_CONNECTION_TEST",
      "CompanySettings",
      settings.id,
      undefined,
      {
        environment: settings.arcaEnvironment,
        testType: action,
        status: "EXITOSA",
      },
    );
    return NextResponse.json({ data: { ...data, durationMs } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo ejecutar la prueba ARCA.";
    const settings = await prisma.companySettings.findFirst();
    if (settings) {
      await prisma.arcaConnectionTest.create({
        data: {
          userId: user?.id,
          environment: settings.arcaEnvironment,
          testType: action,
          status: "ERROR",
          durationMs: Date.now() - started,
          errorCode: (error as any)?.code,
          message,
        },
      });
      await prisma.companySettings.update({
        where: { id: settings.id },
        data: {
          arcaLastConnectionTestAt: new Date(),
          arcaLastConnectionStatus: "ERROR",
          arcaLastConnectionMessage: message,
        },
      });
    }
    return NextResponse.json(
      { error: message, code: (error as any)?.code },
      { status: message.includes("permiso") ? 403 : 400 },
    );
  }
}
