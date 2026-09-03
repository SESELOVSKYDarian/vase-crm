import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!hasAnyPermission(user, ["production.view_all", "production.view_assigned"])) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const order = await prisma.workOrder.findUnique({ where: { id: (await params).id }, include: { client: true, quote: { include: { items: { include: { dvhDetail: true, simpleDetail: true } } } }, items: true, cutOrder: { include: { items: true } }, assemblyOrder: { include: { items: true } }, corteUsuario: { select: { name: true } }, armadoUsuario: { select: { name: true } } } });
  if (!order) return NextResponse.json({ error: "OT no encontrada" }, { status: 404 });
  const canViewAll = hasAnyPermission(user, ["production.view_all", "production.assign"]); const assigned = order.corteUsuarioId === user.id || order.armadoUsuarioId === user.id || order.produccionUsuarioId === user.id;
  if (!canViewAll && !assigned) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json({ data: order });
}
