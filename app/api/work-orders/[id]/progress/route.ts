import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/csrf";

const schema = z.object({ task: z.enum(["CORTE", "ARMADO", "PRODUCCION"]).optional(), sector: z.enum(["CORTE", "ARMADO", "PRODUCCION"]).optional(), itemId: z.string().min(1), quantity: z.coerce.number().int().positive(), note: z.string().trim().max(500).optional() }).refine((value) => value.task || value.sector, { message: "Sector requerido" });
const assignment = { CORTE: "corteUsuarioId", ARMADO: "armadoUsuarioId", PRODUCCION: "produccionUsuarioId" } as const;
const permission = { CORTE: "production.cut.progress.update", ARMADO: "production.assembly.progress.update", PRODUCCION: "production.production.progress.update" } as const;
type Task = keyof typeof assignment;

function authorized(order: { corteUsuarioId: string | null; armadoUsuarioId: string | null; produccionUsuarioId: string | null }, userId: string, task: Task, canManage: boolean) {
  return canManage || order[assignment[task]] === userId;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const id = (await params).id;
  const order = await prisma.workOrder.findUnique({ where: { id }, include: { client: { select: { razonSocial: true } }, items: { select: { id: true, productoNombre: true, cantidad: true, anchoMm: true, altoMm: true, m2: true } }, progressEntries: { include: { user: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }] } } });
  if (!order) return NextResponse.json({ error: "OT inexistente" }, { status: 404 });
  const canManage = hasPermission(user, "production.view_all");
  if (!canManage && !Object.values(assignment).some((field) => order[field] === user.id)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json({ data: { order: { id: order.id, numero: order.numero, obra: order.obra, categoria: order.categoria, fechaEntrega: order.fechaEntrega, estadoProductivo: order.estadoProductivo, observaciones: order.observaciones, client: order.client, assignments: { CORTE: order.corteUsuarioId, ARMADO: order.armadoUsuarioId, PRODUCCION: order.produccionUsuarioId }, items: order.items }, progress: order.progressEntries } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
    const input = schema.parse(await request.json()); const task = (input.task ?? input.sector) as Task; const id = (await params).id;
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({ where: { id }, include: { items: true, client: { select: { razonSocial: true } } } }); if (!order) throw new Error("NOT_FOUND");
      const canManage = hasPermission(user, "production.view_all");
      if (!authorized(order, user.id, task, canManage) || (!canManage && !hasPermission(user, permission[task]))) throw new Error("FORBIDDEN");
      const item = order.items.find((candidate) => candidate.id === input.itemId); if (!item) throw new Error("INVALID_ITEM");
      const aggregate = await tx.productionProgressEntry.aggregate({ where: { workOrderId: id, workOrderItemId: item.id, task }, _sum: { quantity: true } });
      const previous = aggregate._sum.quantity ?? 0; if (previous + input.quantity > item.cantidad) throw new Error(`OVER_LIMIT:${item.cantidad - previous}`);
      const entry = await tx.productionProgressEntry.create({ data: { workOrderId: id, workOrderItemId: item.id, userId: user.id, task, date: new Date(), quantity: input.quantity, note: input.note } });
      const sectorTotals = await tx.productionProgressEntry.groupBy({ by: ["task"], where: { workOrderId: id }, _sum: { quantity: true } });
      const total = order.items.reduce((sum, current) => sum + current.cantidad, 0);
      const totalFor = (currentTask: Task) => sectorTotals.find((row) => row.task === currentTask)?._sum.quantity ?? 0;
      const requiredTasks = (Object.keys(assignment) as Task[]).filter((currentTask) => order[assignment[currentTask]]);
      const sectorCompleted = totalFor(task) >= total;
      const orderCompleted = requiredTasks.length > 0 && requiredTasks.every((currentTask) => totalFor(currentTask) >= total);
      const status = orderCompleted ? "TERMINADA" : "EN_PROCESO";
      const progress = requiredTasks.length ? Math.round((requiredTasks.reduce((sum, currentTask) => sum + Math.min(totalFor(currentTask), total), 0) / (total * requiredTasks.length)) * 100) : 0;
      await tx.workOrder.update({ where: { id }, data: { estadoProductivo: status, porcentajeAvance: progress } });
      if (sectorCompleted) {
        const supervisors = await tx.user.findMany({ where: { active: true, OR: [{ role: "ADMIN" }, { userRoles: { some: { role: { name: { in: ["ADMIN", "ATENCION_CLIENTE"] }, active: true } } } }] }, select: { id: true } });
        await tx.notification.createMany({ data: supervisors.filter((recipient) => recipient.id !== user.id).map((recipient) => ({ userId: recipient.id, type: "OT_COMPLETED", title: `${user.name} completó ${task.toLowerCase()}`, message: `${order.numero} · ${order.client.razonSocial}`, entityType: "WorkOrder", entityId: id, priority: "NORMAL", deduplicationKey: `sector-completed:${id}:${task}:${recipient.id}` })), skipDuplicates: true });
      }
      return { entry, previous, next: previous + input.quantity, remaining: item.cantidad - previous - input.quantity, sectorCompleted, orderCompleted, estadoProductivo: status, porcentajeAvance: progress };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await writeAudit(user.id, "WORK_ORDER_PROGRESS_UPDATED", "WorkOrder", id, { sector: task, itemId: input.itemId, totalAnterior: result.previous }, { cantidadAgregada: input.quantity, totalNuevo: result.next });
    if (result.sectorCompleted) await writeAudit(user.id, "WORK_ORDER_SECTOR_COMPLETED", "WorkOrder", id, undefined, { sector: task });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errorText = message === "FORBIDDEN" ? "No estás asignado a esta tarea." : message.startsWith("OVER_LIMIT:") ? `Solo quedan ${message.split(":")[1]} unidades pendientes.` : message === "INVALID_ITEM" ? "El ítem no pertenece a esta OT." : message === "NOT_FOUND" ? "OT inexistente." : "Datos de avance inválidos.";
    return NextResponse.json({ error: errorText }, { status: message === "FORBIDDEN" ? 403 : message === "NOT_FOUND" ? 404 : 400 });
  }
}
