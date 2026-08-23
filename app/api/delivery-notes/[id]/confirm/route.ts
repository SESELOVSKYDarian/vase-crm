import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const id = (await params).id;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const note = await tx.deliveryNote.findUnique({ where: { id }, include: { workOrder: { include: { items: true, deliveries: true } }, items: true } });
      if (!note) throw new Error("NOT_FOUND"); if (note.estado !== "BORRADOR") throw new Error("INVALID_STATUS");
      const isAssigned = [note.workOrder.operarioId, note.workOrder.corteUsuarioId, note.workOrder.armadoUsuarioId, note.workOrder.produccionUsuarioId].includes(user.id);
      const hasPermission = user.role === "ADMIN" || user.userRoles.some((ur) => ur.role.active && ur.role.permissions.some((rp) => rp.permission.key === "delivery.confirm" || rp.permission.key === "delivery.update"));
      if (!isAssigned && !hasPermission) throw new Error("FORBIDDEN");
      const ordered = note.workOrder.items.reduce((sum, item) => sum + item.cantidad, 0); const already = note.workOrder.deliveries.reduce((sum, item) => sum + item.cantidadEntregada, 0); const amount = note.items.reduce((sum, item) => sum + item.cantidadEntregada, 0);
      if (already + amount > ordered) throw new Error("OVER_LIMIT");
      const delivery = await tx.delivery.create({ data: { workOrderId: note.workOrderId, deliveryNoteId: note.id, cantidadEntregada: amount, items: { create: note.items.map((item) => ({ productoNombre: item.productoNombre, cantidad: item.cantidadEntregada })) } } });
      await tx.deliveryNote.update({ where: { id }, data: { estado: "CONFIRMADO", confirmadoAt: new Date() } });
      const next = already + amount;
      const workOrder = await tx.workOrder.update({ where: { id: note.workOrderId }, data: { estadoEntrega: next >= ordered ? "ENTREGA_COMPLETA" : "ENTREGA_PARCIAL" } });
      return { noteId: note.id, delivery, workOrder, cantidadEntregada: next, cantidadTotal: ordered };
    });
    await writeAudit(user.id, "CONFIRMAR", "DeliveryNote", id, { estado: "BORRADOR" }, { estado: "CONFIRMADO" }); return NextResponse.json({ data: result });
  } catch (error) { const message = error instanceof Error ? error.message : ""; const status = message === "FORBIDDEN" ? 403 : message === "NOT_FOUND" ? 404 : 400; const text = message === "OVER_LIMIT" ? "El remito supera la cantidad pendiente" : message === "INVALID_STATUS" ? "El remito ya fue procesado" : message === "FORBIDDEN" ? "No tenés permiso para confirmar este remito" : "No se pudo confirmar el remito"; return NextResponse.json({ error: text }, { status }); }
}
