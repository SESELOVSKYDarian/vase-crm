import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workOrderStatusSchema } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); const parsed = workOrderStatusSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  const id = (await params).id; const order = await prisma.workOrder.findUnique({ where: { id }, include: { items: true, progressEntries: true } }); if (!order) return NextResponse.json({ error: "OT inexistente" }, { status: 404 });
  const global = hasPermission(user, "production.work_order.status.update"); const assigned = [order.corteUsuarioId, order.armadoUsuarioId, order.produccionUsuarioId].includes(user.id) && hasPermission(user, "production.update_assigned");
  if (!global && !assigned) return NextResponse.json({ error: "No tenés permiso para cambiar esta OT" }, { status: 403 }); if (!global && parsed.data.status === "ANULADA") return NextResponse.json({ error: "Un operario no puede anular una OT" }, { status: 403 });
  if (!global && parsed.data.status === "TERMINADA") { const total = order.items.reduce((sum, item) => sum + item.cantidad, 0); const ownTasks = [order.corteUsuarioId === user.id ? "CORTE" : null, order.armadoUsuarioId === user.id ? "ARMADO" : null, order.produccionUsuarioId === user.id ? "PRODUCCION" : null].filter(Boolean); const completed = order.progressEntries.filter((entry) => ownTasks.includes(entry.task)).reduce((sum, entry) => sum + entry.quantity, 0); if (completed < total) return NextResponse.json({ error: "No podés terminar la OT mientras haya cantidad pendiente." }, { status: 409 }); }
  const updated = await prisma.workOrder.update({ where: { id }, data: { estadoProductivo: parsed.data.status } }); await writeAudit(user.id, "WORK_ORDER_STATUS_CHANGED", "WorkOrder", id, { status: order.estadoProductivo }, { status: updated.estadoProductivo }); return NextResponse.json({ data: updated });
}
