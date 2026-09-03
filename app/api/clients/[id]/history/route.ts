import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!hasPermission(user, "clients.view")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = (await params).id;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const [quotes, orders, invoices, payments, movements] = await Promise.all([
    prisma.quote.findMany({ where: { clientId: id }, orderBy: { fecha: "desc" } }),
    prisma.workOrder.findMany({ where: { clientId: id }, orderBy: { fechaCreacion: "desc" } }),
    prisma.invoice.findMany({ where: { clientId: id }, orderBy: { fecha: "desc" } }),
    prisma.payment.findMany({ where: { clientId: id }, orderBy: { fecha: "desc" } }),
    prisma.accountMovement.findMany({ where: { clientId: id }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }] }),
  ]);
  const total = (rows: any[]) => rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const cobrado = payments.reduce((sum, row) => sum + Number(row.montoEquivalenteArs ?? row.importe), 0);
  const saldo = movements.reduce((sum, row) => sum + Number(row.debe) - Number(row.haber), 0);
  const activity = [
    ...quotes.map((q) => ({ id: `q-${q.id}`, date: q.fecha, label: `Presupuesto ${q.estado.toLowerCase()}`, reference: `${q.numero}${q.titulo ? ` · ${q.titulo}` : ""}`, amount: Number(q.total) })),
    ...invoices.map((i) => ({ id: `i-${i.id}`, date: i.fecha, label: "Factura emitida", reference: i.numero, amount: Number(i.total) })),
    ...payments.map((p) => ({ id: `p-${p.id}`, date: p.fecha, label: "Pago registrado", reference: `${p.numero} · ${p.metodo}`, amount: Number(p.montoEquivalenteArs ?? p.importe) })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return NextResponse.json({ data: { client, quotes, orders, invoices, payments, movements, activity, summary: { totalPresupuestado: total(quotes), totalAprobado: total(quotes.filter((q) => q.estado === "APROBADO")), totalFacturado: total(invoices), totalCobrado: cobrado, saldoPendiente: saldo, cantidadPresupuestos: quotes.length, aprobados: quotes.filter((q) => q.estado === "APROBADO").length, rechazados: quotes.filter((q) => q.estado === "RECHAZADO").length, facturasPendientes: invoices.filter((i) => i.estadoPago !== "PAGADA").length } } });
}
