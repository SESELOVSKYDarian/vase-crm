import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/csrf";

const schema = z.object({ task: z.enum(["CORTE", "ARMADO", "PRODUCCION"]), date: z.string().date(), quantity: z.coerce.number().int().positive(), note: z.string().trim().max(500).optional() });
const assignment = { CORTE: "corteUsuarioId", ARMADO: "armadoUsuarioId", PRODUCCION: "produccionUsuarioId" } as const;
const permission = { CORTE: "production.cut.progress.update", ARMADO: "production.assembly.progress.update", PRODUCCION: "production.production.progress.update" } as const;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); const id = (await params).id; const order = await prisma.workOrder.findUnique({ where: { id }, select: { corteUsuarioId: true, armadoUsuarioId: true, produccionUsuarioId: true } }); if (!order) return NextResponse.json({ error: "OT inexistente" }, { status: 404 }); if (!hasPermission(user, "production.view_all") && !Object.values(order).includes(user.id)) return NextResponse.json({ error: "No autorizado" }, { status: 403 }); return NextResponse.json({ data: await prisma.productionProgressEntry.findMany({ where: { workOrderId: id }, include: { user: { select: { name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }) }); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); const input = schema.parse(await request.json()); const id = (await params).id;
    const entry = await prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({ where: { id }, include: { items: true } }); if (!order) throw new Error("NOT_FOUND");
      const canManage = hasPermission(user, "production.view_all"); const isAssigned = order[assignment[input.task]] === user.id;
      if (!canManage && (!hasPermission(user, permission[input.task]) || !isAssigned)) throw new Error("FORBIDDEN");
      const total = order.items.reduce((sum, item) => sum + item.cantidad, 0); const aggregate = await tx.productionProgressEntry.aggregate({ where: { workOrderId: id, task: input.task }, _sum: { quantity: true } }); const previous = aggregate._sum.quantity ?? 0;
      if (previous + input.quantity > total) throw new Error("OVER_LIMIT");
      const next = previous + input.quantity; const progress = Math.round((next / Math.max(total, 1)) * 100);
      await tx.workOrder.update({ where: { id }, data: { porcentajeAvance: Math.max(order.porcentajeAvance, progress), estadoProductivo: next === total ? "TERMINADA" : order.estadoProductivo === "PENDIENTE" ? "EN_PROCESO" : order.estadoProductivo } });
      return tx.productionProgressEntry.create({ data: { workOrderId: id, userId: user.id, task: input.task, date: new Date(`${input.date}T12:00:00-03:00`), quantity: input.quantity, note: input.note } });
    });
    await writeAudit(user.id, "WORK_ORDER_PROGRESS_UPDATED", "WorkOrder", id, undefined, { task: input.task, increment: input.quantity }); return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) { const message = error instanceof Error ? error.message : ""; return NextResponse.json({ error: message === "FORBIDDEN" ? "No estás asignado a esta tarea." : message === "OVER_LIMIT" ? "La cantidad supera lo pendiente." : message === "NOT_FOUND" ? "OT inexistente." : "Datos de avance inválidos." }, { status: message === "FORBIDDEN" ? 403 : message === "NOT_FOUND" ? 404 : 400 }); }
}
