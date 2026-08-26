import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ recibo: z.string().min(1), observaciones: z.string().max(500).optional() });
function allowed(user: any, key: string) { return hasPermission(user, key); }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!allowed(user, "payments.edit")) return NextResponse.json({ error: "No tenés permiso para editar cobros" }, { status: 403 });
  const id = (await params).id;
  const previous = await prisma.payment.findUnique({ where: { id } });
  if (!previous) return NextResponse.json({ error: "Cobro inexistente" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const payment = await prisma.payment.update({ where: { id }, data: parsed.data });
  await writeAudit(user.id, "EDITAR", "Payment", id, { recibo: previous.recibo, observaciones: previous.observaciones }, { recibo: payment.recibo, observaciones: payment.observaciones });
  return NextResponse.json({ data: payment });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!allowed(user, "payments.delete")) return NextResponse.json({ error: "No tenés permiso para borrar cobros" }, { status: 403 });
  const id = (await params).id;
  const payment = await prisma.payment.findUnique({ where: { id }, include: { allocations: true } });
  if (!payment) return NextResponse.json({ error: "Cobro inexistente" }, { status: 404 });
  const snapshot = { record: { id: payment.id, numero: payment.numero, fecha: payment.fecha, clientId: payment.clientId, recibo: payment.recibo, metodo: payment.metodo, moneda: payment.moneda, importe: payment.importe, montoUsd: payment.montoUsd, tipoCambio: payment.tipoCambio, fechaTipoCambio: payment.fechaTipoCambio, montoEquivalenteArs: payment.montoEquivalenteArs, observaciones: payment.observaciones }, allocations: payment.allocations.map((allocation) => ({ target: allocation.target, invoiceId: allocation.invoiceId, monto: allocation.monto })) };
  await prisma.$transaction(async (tx) => {
    await tx.accountMovement.deleteMany({ where: { referencia: payment.numero, tipo: "PAGO" } });
    await tx.payment.delete({ where: { id } });
  });
  await writeAudit(user.id, "BORRAR", "Payment", id, snapshot, undefined);
  return NextResponse.json({ data: { id } });
}
