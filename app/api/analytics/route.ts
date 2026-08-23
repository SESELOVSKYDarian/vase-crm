import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const n = (v: unknown) => Number(v ?? 0);
const labels: Record<string, string> = { PENDIENTE: "Pendiente", EN_PROCESO: "En proceso", TERMINADA: "Terminada", ANULADA: "Anulada" };
const methodLabels: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE_FISICO: "Cheque físico", ECHEQ: "E-cheq", CHEQUE_TERCEROS: "Cheque de terceros", DOLARES: "Dólares", OTRO: "Otro" };

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") || "TODOS";
  const now = new Date();
  const fallbackFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const from = url.searchParams.get("from") ? new Date(`${url.searchParams.get("from")}T00:00:00-03:00`) : fallbackFrom;
  const end = url.searchParams.get("to") ? new Date(`${url.searchParams.get("to")}T00:00:00-03:00`) : now;
  const to = new Date(end); to.setDate(to.getDate() + 1);
  const typeFilter = tipo === "A" || tipo === "N" ? { tipoFacturacion: tipo as "A" | "N" } : {};
  const date = { gte: from, lt: to };
  const [quotes, invoices, payments, workOrders] = await Promise.all([
    prisma.quote.findMany({ where: { createdAt: date, estado: { not: "ANULADO" }, ...typeFilter }, select: { createdAt: true, total: true, tipoFacturacion: true, estado: true } }),
    prisma.invoice.findMany({ where: { fecha: date, ...typeFilter }, select: { fecha: true, total: true, tipoFacturacion: true, estadoPago: true, allocations: { select: { monto: true } } } }),
    prisma.payment.findMany({ where: { fecha: date }, select: { fecha: true, metodo: true, importe: true, montoEquivalenteArs: true, allocations: { select: { monto: true, invoice: { select: { tipoFacturacion: true } } } } } }),
    prisma.workOrder.findMany({ where: { fechaCreacion: date }, select: { fechaCreacion: true, fechaEntrega: true, estadoProductivo: true, categoria: true, items: { select: { m2: true } } } }),
  ]);
  const amount = (items: { monto: unknown }[]) => items.reduce((s, x) => s + n(x.monto), 0);
  const paymentValue = (p: (typeof payments)[number]) => {
    const base = n(p.montoEquivalenteArs ?? p.importe);
    if (tipo === "TODOS") return base;
    const selected = p.allocations.filter((a) => a.invoice?.tipoFacturacion === tipo);
    const allocated = amount(p.allocations);
    return allocated ? base * amount(selected) / allocated : 0;
  };
  const month = (d: Date) => d.toISOString().slice(0, 7);
  const monthLabel = (key: string) => new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(`${key}-15T12:00:00Z`));
  const monthlyMap = new Map<string, { month: string; label: string; presupuestado: number; facturado: number; cobrado: number }>();
  const addMonth = (d: Date, field: "presupuestado" | "facturado" | "cobrado", value: number) => { const key = month(d); const row = monthlyMap.get(key) || { month: key, label: monthLabel(key), presupuestado: 0, facturado: 0, cobrado: 0 }; row[field] += value; monthlyMap.set(key, row); };
  quotes.forEach((q) => addMonth(q.createdAt, "presupuestado", n(q.total)));
  invoices.forEach((i) => addMonth(i.fecha, "facturado", n(i.total)));
  payments.forEach((p) => addMonth(p.fecha, "cobrado", paymentValue(p)));
  const production = workOrders.reduce((m, w) => { m[w.estadoProductivo] = (m[w.estadoProductivo] || 0) + 1; return m; }, {} as Record<string, number>);
  const methods = payments.reduce((m, p) => { m[p.metodo] = (m[p.metodo] || 0) + paymentValue(p); return m; }, {} as Record<string, number>);
  const categories = workOrders.reduce((m, w) => { m[w.categoria] = (m[w.categoria] || 0) + w.items.reduce((s, i) => s + n(i.m2), 0); return m; }, {} as Record<string, number>);
  const paid = invoices.reduce((s, i) => s + amount(i.allocations), 0);
  const active = workOrders.filter((w) => !["TERMINADA", "ANULADA"].includes(w.estadoProductivo));
  return NextResponse.json({ data: { filters: { from: from.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), tipo }, kpis: { presupuestado: quotes.reduce((s, q) => s + n(q.total), 0), facturado: invoices.reduce((s, i) => s + n(i.total), 0), cobrado: payments.reduce((s, p) => s + paymentValue(p), 0), pendienteCobro: Math.max(0, invoices.reduce((s, i) => s + n(i.total), 0) - paid), presupuestos: quotes.length, otsActivas: active.length, m2EnProduccion: active.reduce((s, w) => s + w.items.reduce((x, i) => x + n(i.m2), 0), 0), otAtrasadas: active.filter((w) => w.fechaEntrega < now).length }, monthly: [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)), production: Object.entries(production).map(([status, count]) => ({ status, label: labels[status] || status, count })), paymentsByMethod: Object.entries(methods).map(([method, value]) => ({ method, label: methodLabels[method] || method, amount: value })).sort((a, b) => b.amount - a.amount), categoryMix: Object.entries(categories).map(([category, m2]) => ({ category, m2 })), quoteStatus: Object.entries(quotes.reduce((m, q) => { m[q.estado] = (m[q.estado] || 0) + 1; return m; }, {} as Record<string, number>)).map(([status, count]) => ({ status, count })) } });
}
