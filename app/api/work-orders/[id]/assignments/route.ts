import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/csrf";

const schema = z.object({ corteUsuarioId: z.string().nullable().optional(), armadoUsuarioId: z.string().nullable().optional(), produccionUsuarioId: z.string().nullable().optional() });
const fields = [{ key: "corteUsuarioId", role: "CORTADOR", task: "corte" }, { key: "armadoUsuarioId", role: "ARMADOR", task: "armado" }, { key: "produccionUsuarioId", role: "PRODUCCION", task: "producción" }] as const;

async function eligible(id: string | null | undefined, roleName: string) { if (!id) return true; return Boolean(await prisma.user.findFirst({ where: { id, active: true, userRoles: { some: { role: { name: roleName, active: true } } }, }, select: { id: true } })); }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const actor = await getCurrentUser(); if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); if (!hasPermission(actor, "production.assign")) return NextResponse.json({ error: "No tenés permiso para asignar operarios" }, { status: 403 });
    const input = schema.parse(await request.json()); const id = (await params).id; const before = await prisma.workOrder.findUnique({ where: { id }, include: { client: true } }); if (!before) return NextResponse.json({ error: "OT inexistente" }, { status: 404 });
    for (const field of fields) if (!(await eligible(input[field.key], field.role))) return NextResponse.json({ error: `El usuario asignado a ${field.task} debe estar activo y tener el rol correspondiente.` }, { status: 400 });
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.workOrder.update({ where: { id }, data: input });
      for (const field of fields) {
        const previous = before[field.key]; const next = input[field.key]; if (previous === next) continue;
        if (previous) await tx.notification.create({ data: { userId: previous, type: "OT_REASSIGNED", title: `${before.numero} fue reasignada`, message: `Ya no estás asignado a ${field.task} en ${before.client.razonSocial}.`, entityType: "WorkOrder", entityId: id, priority: "NORMAL", deduplicationKey: `unassigned:${id}:${field.key}:${previous}:${updated.updatedAt.getTime()}` } });
        if (next) await tx.notification.create({ data: { userId: next, type: previous ? "OT_REASSIGNED" : "OT_ASSIGNED", title: previous ? `Se te reasignó ${before.numero}` : `Nueva orden de ${field.task} asignada`, message: `${before.client.razonSocial} · Entrega ${before.fechaEntrega.toLocaleDateString("es-AR")}`, entityType: "WorkOrder", entityId: id, priority: "HIGH", deduplicationKey: `assigned:${id}:${field.key}:${next}:${updated.updatedAt.getTime()}` } });
      }
      return updated;
    });
    await writeAudit(actor.id, "WORK_ORDER_ASSIGNED", "WorkOrder", id, before, order); return NextResponse.json({ data: order });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Asignación inválida" : "No se pudo guardar la asignación" }, { status: 400 }); }
}
