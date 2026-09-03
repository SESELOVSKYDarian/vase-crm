import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/csrf";

const schema = z.object({ workOrderItemId: z.string().min(1), quantity: z.coerce.number().int().positive(), note: z.string().trim().max(500).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); if (!hasPermission(user, "production.cut.progress.update") && !hasPermission(user, "production.view_all")) return NextResponse.json({ error: "No autorizado" }, { status: 403 }); const input = schema.parse(await request.json()); const workOrderId = (await params).id;
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: { items: true } }); if (!order) throw new Error("NOT_FOUND"); const item = order.items.find((candidate) => candidate.id === input.workOrderItemId); if (!item) throw new Error("INVALID_ITEM");
      const cut = await tx.productionProgressEntry.aggregate({ where: { workOrderId, workOrderItemId: item.id, task: "CORTE" }, _sum: { quantity: true } }); const sent = await tx.productionTransfer.aggregate({ where: { workOrderId, workOrderItemId: item.id, fromTask: "CORTE", toTask: "ARMADO" }, _sum: { quantity: true } }); const available = Number(cut._sum.quantity ?? 0) - Number(sent._sum.quantity ?? 0); if (input.quantity > available) throw new Error(`OVER_LIMIT:${Math.max(0, available)}`);
      const transfer = await tx.productionTransfer.create({ data: { workOrderId, workOrderItemId: item.id, fromTask: "CORTE", toTask: "ARMADO", quantity: input.quantity, createdById: user.id, note: input.note } });
      if (order.armadoUsuarioId) await tx.notification.create({ data: { userId: order.armadoUsuarioId, type: "PRODUCTION_TRANSFER", title: "Nuevas piezas disponibles", message: `${order.numero}: Corte envió ${input.quantity} unidad${input.quantity === 1 ? "" : "es"} para armado.`, entityType: "WorkOrder", entityId: workOrderId, deduplicationKey: `transfer:${transfer.id}` } });
      return { transfer, availableAfter: available - input.quantity };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await writeAudit(user.id, "PRODUCTION_TRANSFER", "WorkOrder", workOrderId, undefined, { fromTask: "CORTE", toTask: "ARMADO", itemId: input.workOrderItemId, quantity: input.quantity }); return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) { const message = error instanceof Error ? error.message : ""; const errorText = message === "NOT_FOUND" ? "OT inexistente." : message === "INVALID_ITEM" ? "El ítem no pertenece a esta OT." : message.startsWith("OVER_LIMIT:") ? `Solo hay ${message.split(":")[1]} unidades disponibles para enviar.` : "No se pudo registrar la transferencia."; return NextResponse.json({ error: errorText }, { status: message === "NOT_FOUND" ? 404 : 400 }); }
}
