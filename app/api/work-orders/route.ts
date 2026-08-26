import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!hasAnyPermission(user, ["production.view_all", "production.view_assigned"])) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const canViewAll = hasAnyPermission(user, ["production.view_all", "production.assign"]);
  const where = canViewAll ? undefined : { OR: [{ corteUsuarioId: user.id }, { armadoUsuarioId: user.id }, { produccionUsuarioId: user.id }] };
  try {
    const orders = await prisma.workOrder.findMany({ where, include: { client: true, items: true, deliveries: true, corteUsuario: { select: { id: true, name: true } }, armadoUsuario: { select: { id: true, name: true } }, produccionUsuario: { select: { id: true, name: true } }, progressEntries: { select: { task: true, quantity: true } } }, orderBy: [{ fechaEntrega: "asc" }, { createdAt: "desc" }] });
    return NextResponse.json({ data: orders.map((order) => ({ ...order, cantidadTotal: order.items.reduce((sum, item) => sum + item.cantidad, 0), cantidadEntregada: order.deliveries.reduce((sum, delivery) => sum + delivery.cantidadEntregada, 0), progressByTask: order.progressEntries.reduce<Record<string, number>>((sum, entry) => ({ ...sum, [entry.task]: (sum[entry.task] ?? 0) + entry.quantity }), {}) })) });
  } catch { return NextResponse.json({ error: "No se pudieron cargar las órdenes" }, { status: 500 }); }
}
