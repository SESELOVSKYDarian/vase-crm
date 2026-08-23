import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
const schema = z.object({ corteUsuarioId: z.string().nullable().optional(), armadoUsuarioId: z.string().nullable().optional(), produccionUsuarioId: z.string().nullable().optional() });
function has(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, key: string) { return user.role === "ADMIN" || user.role === "PRODUCCION" || user.userRoles.some((ur) => ur.role.active && ur.role.permissions.some((rp) => rp.permission.key === key)); }
async function eligible(id: string | null | undefined, permission: string, legacy: "CORTE" | "ARMADO" | "PRODUCCION") {
  if (!id) return true;
  const user = await prisma.user.findFirst({
    where: {
      id, active: true,
      OR: [
        { role: legacy },
        { userRoles: { some: { role: { active: true, permissions: { some: { permission: { key: permission } } } } } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(user);
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); if (!has(user, "production.assign")) return NextResponse.json({ error: "No tenés permiso para asignar operarios" }, { status: 403 }); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Asignación inválida" }, { status: 400 }); const data = parsed.data; const checks = await Promise.all([eligible(data.corteUsuarioId, "production.cut.progress.update", "CORTE"), eligible(data.armadoUsuarioId, "production.assembly.progress.update", "ARMADO"), eligible(data.produccionUsuarioId, "production.production.progress.update", "PRODUCCION")]); if (checks.some((ok) => !ok)) return NextResponse.json({ error: "Hay un usuario inactivo o sin el permiso requerido" }, { status: 400 }); try { const id = (await params).id; const before = await prisma.workOrder.findUnique({ where: { id } }); if (!before) return NextResponse.json({ error: "OT inexistente" }, { status: 404 }); const order = await prisma.workOrder.update({ where: { id }, data }); await writeAudit(user.id, "ASIGNAR", "WorkOrder", id, before, order); return NextResponse.json({ data: order }); } catch { return NextResponse.json({ error: "No se pudo guardar la asignación" }, { status: 500 }); } }
