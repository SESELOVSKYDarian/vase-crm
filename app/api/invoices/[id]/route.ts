import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ cuit: z.string().min(1).optional(), puntoVenta: z.coerce.number().int().positive().optional() });
function allowed(user: any, key: string) { return hasPermission(user, key); }

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const invoice = await prisma.invoice.findUnique({ where: { id: (await params).id }, include: { client: true, workOrder: true, items: true } });
  if (!invoice) return NextResponse.json({ error: "Factura inexistente" }, { status: 404 });
  return NextResponse.json({ data: invoice });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!allowed(user, "invoices.edit")) return NextResponse.json({ error: "No tenés permiso para editar facturas" }, { status: 403 });
  const id = (await params).id;
  const previous = await prisma.invoice.findUnique({ where: { id } });
  if (!previous) return NextResponse.json({ error: "Factura inexistente" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const invoice = await prisma.invoice.update({ where: { id }, data: parsed.data });
  await writeAudit(user.id, "EDITAR", "Invoice", id, { cuit: previous.cuit, puntoVenta: previous.puntoVenta }, { cuit: invoice.cuit, puntoVenta: invoice.puntoVenta });
  return NextResponse.json({ data: invoice });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!allowed(user, "invoices.delete")) return NextResponse.json({ error: "No tenés permiso para borrar facturas" }, { status: 403 });
  const id = (await params).id;
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { allocations: true, items: true } });
  if (!invoice) return NextResponse.json({ error: "Factura inexistente" }, { status: 404 });
  if (invoice.allocations.length) return NextResponse.json({ error: "No se puede borrar una factura con cobros imputados" }, { status: 409 });
  const snapshot = { record: { id: invoice.id, numero: invoice.numero, tipoFacturacion: invoice.tipoFacturacion, arcaVoucherType: invoice.arcaVoucherType, clientId: invoice.clientId, workOrderId: invoice.workOrderId, fecha: invoice.fecha, cuit: invoice.cuit, condicionIva: invoice.condicionIva, puntoVenta: invoice.puntoVenta, moneda: invoice.moneda, subtotal: invoice.subtotal, iva: invoice.iva, tributos: invoice.tributos, total: invoice.total, cae: invoice.cae, vencimientoCae: invoice.vencimientoCae, estadoArca: invoice.estadoArca, estadoPago: invoice.estadoPago }, items: invoice.items.map((item) => ({ descripcion: item.descripcion, cantidad: item.cantidad, precioUnitario: item.precioUnitario, subtotal: item.subtotal })) };
  await prisma.$transaction(async (tx) => {
    await tx.accountMovement.deleteMany({ where: { referencia: invoice.numero, tipo: "FACTURA" } });
    await tx.invoice.delete({ where: { id } });
  });
  await writeAudit(user.id, "BORRAR", "Invoice", id, snapshot, undefined);
  return NextResponse.json({ data: { id } });
}
