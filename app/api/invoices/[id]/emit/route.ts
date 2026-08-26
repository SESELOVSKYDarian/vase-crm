import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getArcaProvider } from "@/modules/arca/server";

const fallbackNumber = (number: string) => Number(number.match(/(\d+)(?!.*\d)/)?.[1] ?? 0);

/** Emits an already stored NC/ND draft. The draft remains financially inert until this succeeds. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origen de solicitud inválido." }, { status: 403 }); }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const id = (await params).id;
  const draft = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, originalInvoice: true },
  });
  if (!draft || !draft.originalInvoice || draft.documentType === "FACTURA") return NextResponse.json({ error: "Borrador de ajuste inexistente." }, { status: 404 });
  const permission = draft.documentType === "NOTA_CREDITO" ? "credit_notes.create" : "debit_notes.create";
  if (!hasPermission(user, permission)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (draft.documentStatus !== "BORRADOR") return NextResponse.json({ error: "El comprobante ya fue emitido." }, { status: 409 });
  const original = draft.originalInvoice;
  if (original.tipoFacturacion === "A" && original.estadoArca !== "AUTORIZADA") return NextResponse.json({ error: "La factura original debe tener CAE antes de emitir una nota." }, { status: 409 });

  // Las actualizaciones de Prisma no incluyen relaciones; sólo necesitamos
  // campos escalares para autorizar y registrar el movimiento.
  let emitted: any = draft;
  if (original.tipoFacturacion === "A") {
    try {
      const settings = await prisma.companySettings.findFirst();
      const { provider } = await getArcaProvider();
      const result = await provider.authorizeInvoice({
        idempotencyKey: `adjustment:${draft.id}`,
        environment: provider.getEnvironment(),
        puntoVenta: draft.puntoVenta,
        voucherType: draft.arcaVoucherType!,
        cuitEmisor: settings?.arcaCuit ?? "",
        clienteDocTipo: "CUIT",
        clienteDocNumero: draft.cuit.replace(/\D/g, ""),
        condicionIvaReceptor: draft.condicionIva,
        fecha: draft.fecha.toISOString().slice(0, 10),
        importeNeto: Number(draft.subtotal),
        importeIva: Number(draft.iva),
        importeTributos: Number(draft.tributos),
        importeTotal: Number(draft.total),
        moneda: "PES", cotizacionMoneda: 1, conceptos: "PRODUCTOS",
        associatedVoucher: { voucherType: original.arcaVoucherType ?? "FACTURA_A", puntoVenta: original.puntoVenta, numero: original.arcaNumero ?? fallbackNumber(original.numero), cuit: settings?.arcaCuit?.replace(/\D/g, ""), fecha: original.fecha.toISOString().slice(0, 10) },
      });
      emitted = await prisma.$transaction(async (tx) => {
        const updated = await tx.invoice.update({ where: { id }, data: { documentStatus: "EMITIDO", estadoArca: result.estado, cae: result.cae, arcaNumero: result.numeroComprobante ?? null, vencimientoCae: result.vencimientoCae ? new Date(`${result.vencimientoCae}T00:00:00-03:00`) : null } });
        await tx.arcaTransaction.upsert({ where: { idempotencyKey: `adjustment:${draft.id}` }, create: { invoiceId: draft.id, idempotencyKey: `adjustment:${draft.id}`, environment: provider.getEnvironment(), requestPayload: result.requestRaw as any, responsePayload: result.responseRaw as any, resultado: result.estado, errores: { errores: result.errores, observaciones: result.observaciones } }, update: { responsePayload: result.responseRaw as any, resultado: result.estado, errores: { errores: result.errores, observaciones: result.observaciones } } });
        return updated;
      });
    } catch (error) {
      emitted = await prisma.invoice.update({ where: { id }, data: { documentStatus: "EMITIDO", estadoArca: "ERROR" } });
      await prisma.arcaTransaction.upsert({ where: { idempotencyKey: `adjustment:${draft.id}` }, create: { invoiceId: draft.id, idempotencyKey: `adjustment:${draft.id}`, environment: "HOMOLOGACION", requestPayload: {}, resultado: "ERROR", errores: { message: error instanceof Error ? error.message : "Error ARCA" } }, update: { resultado: "ERROR", errores: { message: error instanceof Error ? error.message : "Error ARCA" } } });
    }
  } else {
    emitted = await prisma.invoice.update({ where: { id }, data: { documentStatus: "EMITIDO", estadoArca: "NO_APLICA" } });
  }

  if (original.tipoFacturacion === "N" || emitted.estadoArca === "AUTORIZADA") {
    const credit = emitted.documentType === "NOTA_CREDITO";
    await prisma.$transaction(async (tx) => {
      const balances = await tx.accountMovement.aggregate({ where: { clientId: emitted.clientId }, _sum: { debe: true, haber: true } });
      await tx.accountMovement.create({ data: { clientId: emitted.clientId, tipo: credit ? "NOTA_CREDITO" : "NOTA_DEBITO", referencia: emitted.numero, debe: credit ? 0 : Number(emitted.total), haber: credit ? Number(emitted.total) : 0, saldo: Number(balances._sum.debe ?? 0) - Number(balances._sum.haber ?? 0) + (credit ? -Number(emitted.total) : Number(emitted.total)) } });
    });
  }
  await writeAudit(user.id, emitted.estadoArca === "AUTORIZADA" || emitted.tipoFacturacion === "N" ? "ADJUSTMENT_EMITTED" : "ADJUSTMENT_ISSUE_FAILED", "Invoice", emitted.id, { documentStatus: "BORRADOR" }, { documentStatus: "EMITIDO", estadoArca: emitted.estadoArca });
  return NextResponse.json({ data: emitted });
}
