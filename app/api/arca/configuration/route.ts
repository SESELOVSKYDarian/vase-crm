import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { arcaConfigurationReset, invalidateArcaTickets } from "@/lib/arca/configuration";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/csrf";

function isAdmin(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return user.isSuperAdmin || user.role === "ADMIN" || user.userRoles.some((entry) => entry.role.name === "ADMIN");
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, "company.settings.manage") || !isAdmin(user)) return NextResponse.json({ error: "Sólo un administrador puede borrar la configuración ARCA." }, { status: 403 });
    const body = await request.json().catch(() => null);
    if (body?.confirmation !== "BORRAR ARCA") return NextResponse.json({ error: "Escribí BORRAR ARCA para confirmar la eliminación." }, { status: 409 });
    const current = await prisma.companySettings.findFirst();
    if (!current) return NextResponse.json({ data: null });
    await prisma.$transaction(async (tx) => {
      await tx.arcaCredentialFile.deleteMany({});
      await invalidateArcaTickets(tx);
      await tx.companySettings.update({ where: { id: current.id }, data: arcaConfigurationReset });
    });
    await writeAudit(user.id, "ARCA_CONFIGURATION_CLEARED", "CompanySettings", current.id, { configured: Boolean(current.arcaCuit || current.arcaCertificate || current.arcaPrivateKey) }, { configured: false });
    await writeAudit(user.id, "ARCA_ACCESS_TICKETS_INVALIDATED", "CompanySettings", current.id, undefined, { scope: "all" });
    return NextResponse.json({ data: { message: "Configuración ARCA eliminada. La integración fiscal quedó deshabilitada." } });
  } catch (error) {
    const message = error instanceof Error && !["FORBIDDEN", "UNAUTHENTICATED"].includes(error.message) ? error.message : "No se pudo borrar la configuración ARCA.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
