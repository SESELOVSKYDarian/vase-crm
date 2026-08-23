import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
const schema = z.object({ motivo: z.string().trim().min(5).max(500) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Indicá un motivo de anulación" }, { status: 400 });
  const id = (await params).id;
  try { const result = await prisma.$transaction(async (tx) => { const note = await tx.deliveryNote.findUnique({ where: { id }, include: { delivery: true, workOrder: { include: { items: true, deliveries: true } } } }); if (!note || note.estado === "ANULADO") throw new Error("INVALID"); const allowed = user.role === "ADMIN" || user.userRoles.some((ur) => ur.role.active && ur.role.permissions.some((rp) => rp.permission.key === "delivery.cancel")); if (!allowed) throw new Error("FORBIDDEN"); if (note.delivery) await tx.delivery.delete({ where: { id: note.delivery.id } }); const deliveries = await tx.delivery.aggregate({ where: { workOrderId: note.workOrderId, id: { not: note.delivery?.id } }, _sum: { cantidadEntregada: true } }); const ordered = note.workOrder.items.reduce((sum, item) => sum + item.cantidad, 0); const delivered = deliveries._sum.cantidadEntregada ?? 0; await tx.workOrder.update({ where: { id: note.workOrderId }, data: { estadoEntrega: delivered === 0 ? "SIN_ENTREGAR" : delivered >= ordered ? "ENTREGA_COMPLETA" : "ENTREGA_PARCIAL" } }); return tx.deliveryNote.update({ where: { id }, data: { estado: "ANULADO", motivoAnulacion: parsed.data.motivo } }); }); await writeAudit(user.id, "ANULAR", "DeliveryNote", id, undefined, { motivo: parsed.data.motivo }); return NextResponse.json({ data: result }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "No tenés permiso para anular remitos" : "No se pudo anular el remito" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 }); }
}
