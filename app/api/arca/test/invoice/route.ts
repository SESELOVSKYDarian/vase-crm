import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { getArcaProvider } from "@/modules/arca/server";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  puntoVenta: z.coerce.number().int().positive(),
  clienteDocTipo: z.enum(["CUIT", "DNI", "CONSUMIDOR_FINAL"]),
  clienteDocNumero: z.string().min(1),
  importeNeto: z.coerce.number().positive(),
  importeIva: z.coerce.number().min(0),
  importeTributos: z.coerce.number().min(0).default(0),
  importeTotal: z.coerce.number().positive(),
  fecha: z.string().date(),
  moneda: z.enum(["PES", "DOL"]).default("PES"),
  cotizacionMoneda: z.coerce.number().positive().default(1),
  conceptos: z
    .enum(["PRODUCTOS", "SERVICIOS", "PRODUCTOS_Y_SERVICIOS"])
    .default("PRODUCTOS"),
});
export async function POST(request: Request) {
  const started = Date.now();
  let user: any;
  try {
    assertSameOrigin(request);
    user = await requirePermission("arca.invoice.test");
    const input = schema.parse(await request.json());
    const { provider, settings } = await getArcaProvider();
    if (provider.getEnvironment() !== "HOMOLOGACION")
      return NextResponse.json(
        { error: "La prueba de emisión sólo está disponible en homologación." },
        { status: 403 },
      );
    if (
      Math.abs(
        input.importeNeto +
          input.importeIva +
          input.importeTributos -
          input.importeTotal,
      ) > 0.01
    )
      return NextResponse.json(
        { error: "El total debe coincidir con neto + IVA + tributos." },
        { status: 400 },
      );
    const result = await provider.authorizeInvoice({
      ...input,
      idempotencyKey: `arca-test:${settings.arcaCuit}:${input.puntoVenta}:${input.fecha}:${input.importeTotal}:${input.clienteDocNumero}`,
      environment: "HOMOLOGACION",
      voucherType: "FACTURA_A",
      cuitEmisor: settings.arcaCuit!,
      condicionIvaReceptor: "RESPONSABLE_INSCRIPTO",
    });
    await prisma.arcaConnectionTest.create({
      data: {
        userId: user.id,
        environment: "HOMOLOGACION",
        testType: "EMISION_PRUEBA",
        status: result.ok ? "EXITOSA" : "RECHAZADA",
        durationMs: Date.now() - started,
        errorCode: result.errores[0]?.codigo,
        message: result.ok
          ? `CAE de homologación autorizado: ${result.cae}`
          : result.errores.map((e) => `${e.codigo}: ${e.mensaje}`).join(" | "),
      },
    });
    await writeAudit(
      user.id,
      "ARCA_TEST_INVOICE_REQUESTED",
      "CompanySettings",
      settings.id,
      undefined,
      {
        environment: "HOMOLOGACION",
        status: result.estado,
        voucher: result.numeroComprobante,
      },
    );
    return NextResponse.json({
      data: {
        ok: result.ok,
        estado: result.estado,
        cae: result.cae,
        vencimientoCae: result.vencimientoCae,
        numeroComprobante: result.numeroComprobante,
        errores: result.errores,
        observaciones: result.observaciones,
        durationMs: Date.now() - started,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo emitir la prueba.",
      },
      { status: 400 },
    );
  }
}
