import { NextResponse } from "next/server";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { writeAudit } from "@/lib/audit";
import { assertCrudAllowed, hasUserActivity, SUPER_ADMIN_ERROR } from "@/lib/user-protection";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const actor = await requirePermission("users.manage"); const id = (await params).id;
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isSuperAdmin: true, active: true, _count: { select: { auditLogs: true, progressEntries: true, notifications: true, quotesCreated: true, otsAssigned: true, otsCorte: true, otsArmado: true, otsProduccion: true } } } });
    if (!user) return NextResponse.json({ error: "Usuario inexistente." }, { status: 404 }); assertCrudAllowed(user.isSuperAdmin);
    const pendingAssignments = await prisma.workOrder.count({ where: { estadoProductivo: { in: ["PENDIENTE", "EN_PROCESO"] }, OR: [{ corteUsuarioId: id }, { armadoUsuarioId: id }, { produccionUsuarioId: id }, { operarioId: id }] } });
    if (pendingAssignments > 0) return NextResponse.json({ error: `Este usuario tiene ${pendingAssignments} OT pendientes asignadas. Reasignalas antes de desactivarlo.`, pendingAssignments }, { status: 409 });
    if (hasUserActivity(user._count)) { await prisma.$transaction([prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }), prisma.user.update({ where: { id }, data: { active: false } })]); await writeAudit(actor.id, "USER_DISABLED", "User", id, { active: user.active }, { active: false, reason: "Actividad histórica preservada" }); return NextResponse.json({ data: { action: "DEACTIVATED", message: "Este usuario posee actividad registrada y fue desactivado para conservar el historial." } }); }
    await prisma.user.delete({ where: { id } }); await writeAudit(actor.id, "USER_DELETED", "User", id, undefined, { deleted: true }); return NextResponse.json({ data: { action: "DELETED" } });
  } catch (error) { const protectedAccount = error instanceof Error && error.message === "SUPER_ADMIN_PROTECTED"; return NextResponse.json({ error: protectedAccount ? SUPER_ADMIN_ERROR : "No se pudo eliminar el usuario." }, { status: protectedAccount ? 403 : 400 }); }
}
