import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ quantity: z.coerce.number().int().positive(), date: z.string().optional(), note: z.string().max(500).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Ingresá una cantidad válida" }, { status: 400 });
  const { id } = await params;
  const order = await prisma.workOrder.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "La orden de trabajo no existe" }, { status: 404 });
  const assigned = [order.operarioId, order.corteUsuarioId, order.armadoUsuarioId, order.produccionUsuarioId].includes(user.id);
  const canEdit = user.role === "ADMIN" || assigned || user.userRoles.some((entry) => entry.role.active && entry.role.permissions.some((permission) => permission.permission.key === "delivery.update"));
  if (!canEdit) return NextResponse.json({ error: "No tenés permiso para registrar entregas de esta OT" }, { status: 403 });
  const requested = order.items.reduce((sum, item) => sum + item.cantidad, 0);
  const delivered = await prisma.delivery.aggregate({ where: { workOrderId: id }, _sum: { cantidadEntregada: true } });
  const current = delivered._sum.cantidadEntregada ?? 0;
  if (current + parsed.data.quantity > requested) return NextResponse.json({ error: `Sólo quedan ${Math.max(0, requested - current)} unidades pendientes` }, { status: 400 });
  const next = current + parsed.data.quantity;
  const result = await prisma.$transaction(async (tx) => {
    await tx.delivery.create({ data: { workOrderId: id, fecha: parsed.data.date ? new Date(parsed.data.date) : new Date(), cantidadEntregada: parsed.data.quantity } });
    return tx.workOrder.update({ where: { id }, data: { estadoEntrega: next >= requested ? "ENTREGA_COMPLETA" : "ENTREGA_PARCIAL", observaciones: parsed.data.note ? [order.observaciones, `Entrega: ${parsed.data.note}`].filter(Boolean).join("\n") : order.observaciones }, include: { client: true, items: true } });
  });
  return NextResponse.json({ data: { ...result, cantidadEntregada: next, cantidadTotal: requested } });
}
