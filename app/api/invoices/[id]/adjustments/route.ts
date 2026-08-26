import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getArcaProvider } from "@/modules/arca/server";
import { relatedVoucherType, remainingCredit, totalsFromItems } from "@/lib/fiscal-documents";
import { writeAudit } from "@/lib/audit";

const reason = z.enum(["DEVOLUCION", "ERROR_FACTURACION", "BONIFICACION", "DESCUENTO_POSTERIOR", "CANCELACION_TOTAL", "CANCELACION_PARCIAL", "DIFERENCIA_PRECIO", "INTERESES", "GASTOS_ADICIONALES", "AJUSTE", "OTRO"]);
const schema = z.object({ kind: z.enum(["NOTA_CREDITO", "NOTA_DEBITO"]), mode: z.enum(["BORRADOR", "EMITIR"]).default("BORRADOR"), reason, reasonDescription: z.string().trim().max(500).optional(), items: z.array(z.object({ originalItemId: z.string().optional(), descripcion: z.string().min(1), quantity: z.coerce.number().int().positive(), price: z.coerce.number().nonnegative() })).min(1) }).superRefine((input, ctx) => { if (input.reason === "OTRO" && !input.reasonDescription) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reasonDescription"], message: "Indicá la descripción del motivo." }); });
const numericPart = (number: string) => Number(number.match(/(\d+)(?!.*\d)/)?.[1] ?? 0);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user || !hasPermission(user, "invoices.view")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const invoice = await prisma.invoice.findUnique({ where: { id: (await params).id }, include: { adjustments: { include: { items: true } } } });
  if (!invoice) return NextResponse.json({ error: "Factura inexistente" }, { status: 404 });
  return NextResponse.json({ data: invoice.adjustments });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); const id = (await params).id; if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const permission = input.data.kind === "NOTA_CREDITO" ? "credit_notes.create" : "debit_notes.create"; if (!hasPermission(user, permission)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const original = await prisma.invoice.findUnique({ where: { id }, include: { client: true, items: true, adjustments: { where: { documentType: "NOTA_CREDITO", documentStatus: "EMITIDO" }, include: { items: true } } } });
  if (!original || original.documentType !== "FACTURA") return NextResponse.json({ error: "La factura original no existe." }, { status: 404 });
  if (original.tipoFacturacion === "A" && original.estadoArca !== "AUTORIZADA") return NextResponse.json({ error: "La factura A debe estar autorizada por ARCA antes de emitir una nota." }, { status: 409 });
  const source = new Map(original.items.map((item) => [item.id, item]));
  for (const item of input.data.items) { if (item.originalItemId && !source.has(item.originalItemId)) return NextResponse.json({ error: "Un ítem no pertenece a la factura original." }, { status: 400 }); }
  // Una NC replica precios autorizados: sólo se puede rectificar cantidad, no
  // alterar el precio original desde el navegador.
  const items = input.data.items.map((item) => ({ ...item, price: input.data.kind === "NOTA_CREDITO" && item.originalItemId ? Number(source.get(item.originalItemId)!.precioUnitario) : item.price }));
  const totals = totalsFromItems(items.map((item) => ({ quantity: item.quantity, price: item.price })));
  if (input.data.kind === "NOTA_CREDITO") {
    const emittedCredit = original.adjustments.reduce((sum, adjustment) => sum + Number(adjustment.total), 0); const remaining = remainingCredit(Number(original.total), emittedCredit);
    if (totals.total > remaining + 0.01) return NextResponse.json({ error: `La nota supera el saldo acreditable de ${remaining.toFixed(2)}.`, remaining }, { status: 409 });
    for (const item of input.data.items.filter((item) => item.originalItemId)) { const base = source.get(item.originalItemId!)!; const already = original.adjustments.flatMap((adjustment) => adjustment.items).filter((previous) => previous.originalInvoiceItemId === item.originalItemId).reduce((sum, previous) => sum + previous.cantidad, 0); if (item.quantity + already > base.cantidad) return NextResponse.json({ error: `La cantidad acreditada de ${base.descripcion} supera la facturada.` }, { status: 409 }); }
  }
  const voucher = original.tipoFacturacion === "A" ? relatedVoucherType(original.arcaVoucherType ?? "FACTURA_A", input.data.kind) : null;
  const count = await prisma.invoice.count(); const prefix = input.data.kind === "NOTA_CREDITO" ? "NC" : "ND";
  const created = await prisma.invoice.create({ data: { numero: `${prefix}${original.tipoFacturacion}-${String(count + 1).padStart(6, "0")}`, tipoFacturacion: original.tipoFacturacion, documentType: input.data.kind, documentStatus: input.data.mode === "EMITIR" ? "EMITIDO" : "BORRADOR", arcaVoucherType: voucher as any, originalInvoiceId: original.id, motivo: input.data.reason, motivoDescripcion: input.data.reasonDescription, clientId: original.clientId, workOrderId: original.workOrderId, cuit: original.cuit, condicionIva: original.condicionIva, puntoVenta: original.puntoVenta, moneda: original.moneda, subtotal: totals.subtotal, iva: totals.iva, tributos: totals.tributos, total: totals.total, estadoArca: input.data.mode === "EMITIR" && original.tipoFacturacion === "A" ? "PENDIENTE" : "NO_APLICA", items: { create: items.map((item) => ({ descripcion: item.descripcion, cantidad: item.quantity, precioUnitario: item.price, subtotal: item.quantity * item.price, originalInvoiceItemId: item.originalItemId })) } }, include: { items: true } });
  if (input.data.mode === "BORRADOR") { await writeAudit(user.id, input.data.kind === "NOTA_CREDITO" ? "CREDIT_NOTE_DRAFT_CREATED" : "DEBIT_NOTE_DRAFT_CREATED", "Invoice", created.id, undefined, { originalInvoiceId: original.id, total: totals.total }); return NextResponse.json({ data: created }, { status: 201 }); }
  let issued: any = created;
  if (original.tipoFacturacion === "A") {
    try { const settings = await prisma.companySettings.findFirst(); const { provider } = await getArcaProvider(); const result = await provider.authorizeInvoice({ idempotencyKey: `adjustment:${created.id}`, environment: provider.getEnvironment(), puntoVenta: original.puntoVenta, voucherType: voucher!, cuitEmisor: settings?.arcaCuit ?? "", clienteDocTipo: "CUIT", clienteDocNumero: original.cuit.replace(/\D/g, ""), condicionIvaReceptor: original.condicionIva, fecha: created.fecha.toISOString().slice(0, 10), importeNeto: totals.subtotal, importeIva: totals.iva, importeTributos: totals.tributos, importeTotal: totals.total, moneda: "PES", cotizacionMoneda: 1, conceptos: "PRODUCTOS", associatedVoucher: { voucherType: original.arcaVoucherType ?? "FACTURA_A", puntoVenta: original.puntoVenta, numero: original.arcaNumero ?? numericPart(original.numero), cuit: settings?.arcaCuit?.replace(/\D/g, ""), fecha: original.fecha.toISOString().slice(0, 10) } }); issued = await prisma.invoice.update({ where: { id: created.id }, data: { estadoArca: result.estado, cae: result.cae, arcaNumero: result.numeroComprobante ?? null, vencimientoCae: result.vencimientoCae ? new Date(`${result.vencimientoCae}T00:00:00-03:00`) : null } }); await prisma.arcaTransaction.create({ data: { invoiceId: created.id, idempotencyKey: `adjustment:${created.id}`, environment: provider.getEnvironment(), requestPayload: result.requestRaw as any, responsePayload: result.responseRaw as any, resultado: result.estado, errores: { errores: result.errores, observaciones: result.observaciones } } }); if (result.estado !== "AUTORIZADA") await writeAudit(user.id, input.data.kind === "NOTA_CREDITO" ? "CREDIT_NOTE_REJECTED" : "DEBIT_NOTE_REJECTED", "Invoice", created.id, undefined, { estado: result.estado }); } catch (error) { issued = await prisma.invoice.update({ where: { id: created.id }, data: { estadoArca: "ERROR" } }); await prisma.arcaTransaction.create({ data: { invoiceId: created.id, idempotencyKey: `adjustment:${created.id}`, environment: "HOMOLOGACION", requestPayload: {}, resultado: "ERROR", errores: { message: error instanceof Error ? error.message : "Error ARCA" } } }); }
  }
  const authorized = original.tipoFacturacion === "N" || issued.estadoArca === "AUTORIZADA"; if (authorized) { const balance = await prisma.accountMovement.aggregate({ where: { clientId: original.clientId }, _sum: { debe: true, haber: true } }); const credit = input.data.kind === "NOTA_CREDITO"; await prisma.accountMovement.create({ data: { clientId: original.clientId, tipo: credit ? "NOTA_CREDITO" : "NOTA_DEBITO", referencia: issued.numero, debe: credit ? 0 : totals.total, haber: credit ? totals.total : 0, saldo: Number(balance._sum.debe ?? 0) - Number(balance._sum.haber ?? 0) + (credit ? -totals.total : totals.total) } }); await writeAudit(user.id, credit ? "CREDIT_NOTE_AUTHORIZED" : "DEBIT_NOTE_AUTHORIZED", "Invoice", issued.id, undefined, { originalInvoiceId: original.id, total: totals.total }); }
  return NextResponse.json({ data: issued }, { status: 201 });
}
