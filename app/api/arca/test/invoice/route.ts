import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { getArcaProvider } from "@/modules/arca/server";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { writeAudit } from "@/lib/audit";
import { ARCA_VOUCHER_TYPES, getArcaVoucher, requiresAssociatedVoucher } from "@/modules/arca/vouchers";
import type { ArcaVoucherType } from "@/modules/arca/types";

const schema = z.object({
  puntoVenta: z.coerce.number().int().positive(),
  voucherType: z.enum(ARCA_VOUCHER_TYPES.map((item) => item.key) as [string, ...string[]]),
  clienteDocTipo: z.string().min(1),
  clienteDocCode: z.coerce.number().int().nonnegative(),
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
  ivaId: z.coerce.number().int().positive().optional(),
  associatedVoucher: z.object({
    voucherType: z.enum(ARCA_VOUCHER_TYPES.map((item) => item.key) as [string, ...string[]]),
    puntoVenta: z.coerce.number().int().positive(),
    numero: z.coerce.number().int().positive(),
    cuit: z.string().optional(),
    fecha: z.string().date().optional(),
  }).optional(),
});
export async function POST(request: Request) {
  const started = Date.now();
  let user: any;
  try {
    assertSameOrigin(request);
    user = await requirePermission("arca.invoice.test");
    const input = schema.parse(await request.json());
    const voucherType = input.voucherType as ArcaVoucherType;
    const voucher = getArcaVoucher(voucherType);
    if (!voucher || !voucher.testEnabled)
      return NextResponse.json({ error: voucher?.disabledReason ?? "Tipo de comprobante no habilitado para esta prueba." }, { status: 409 });
    if (requiresAssociatedVoucher(voucherType) && !input.associatedVoucher)
      return NextResponse.json({ error: "La nota requiere tipo, punto de venta y número del comprobante asociado." }, { status: 400 });
    if ((input.voucherType === "FACTURA_C" || input.voucherType.endsWith("_C")) && input.importeIva !== 0)
      return NextResponse.json({ error: "Los comprobantes C de esta prueba deben emitirse sin IVA discriminado." }, { status: 400 });
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
      voucherType,
      associatedVoucher: input.associatedVoucher ? { ...input.associatedVoucher, voucherType: input.associatedVoucher.voucherType as ArcaVoucherType } : undefined,
      idempotencyKey: `arca-test:${settings.arcaCuit}:${input.puntoVenta}:${input.voucherType}:${input.fecha}:${input.importeTotal}:${input.clienteDocNumero}:${input.associatedVoucher?.numero ?? ""}`,
      environment: "HOMOLOGACION",
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
        voucher: { key: voucher.key, code: voucher.code, label: voucher.label },
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
