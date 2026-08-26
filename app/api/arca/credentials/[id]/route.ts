import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { writeAudit } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await requirePermission("company.settings.manage"); const input = await request.json().catch(() => ({})); const id = (await params).id;
    const file = await prisma.arcaCredentialFile.findUnique({ where: { id } }); if (!file) return NextResponse.json({ error: "Archivo inexistente." }, { status: 404 });
    if (file.active && input.confirmation !== "ELIMINAR") return NextResponse.json({ error: "Confirmá ELIMINAR para borrar la credencial activa." }, { status: 409 });
    await prisma.$transaction(async (tx) => { await tx.arcaCredentialFile.delete({ where: { id } }); if (file.active) { const settings = await tx.companySettings.findFirst(); if (settings) await tx.companySettings.update({ where: { id: settings.id }, data: { arcaCertificate: null, arcaPrivateKey: null, arcaCertificateSubject: null, arcaCertificateIssuer: null, arcaCertificateSerial: null, arcaCertificateValidFrom: null, arcaCertificateValidTo: null, arcaCredentialSource: null, arcaLastConnectionStatus: "SIN_CONFIGURAR", arcaLastConnectionMessage: "Credencial activa eliminada." } }); await tx.arcaAccessTicket.deleteMany({ where: { environment: file.environment } }); } });
    await writeAudit(user.id, "ARCA_CREDENTIAL_FILE_DELETED", "ArcaCredentialFile", id, undefined, { fileName: file.originalFileName, active: file.active, environment: file.environment }); return NextResponse.json({ ok: true, clearedActiveCredential: file.active });
  } catch { return NextResponse.json({ error: "No se pudo eliminar el archivo." }, { status: 400 }); }
}
