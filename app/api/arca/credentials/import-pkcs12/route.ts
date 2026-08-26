import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { encryptSecret } from "@/lib/security/encryption";
import { encryptBinary } from "@/lib/security/encryption";
import { importPkcs12WithCompatibility, Pkcs12ImportError, validatePkcs12Upload } from "@/lib/arca/pkcs12";
import { writeAudit } from "@/lib/audit";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let buffer: Buffer | undefined;
  try {
    assertSameOrigin(request);
    const user = await requirePermission("company.settings.manage");
    const form = await request.formData();
    const file = form.get("file");
    const rawPassword = form.get("password");
    if (!(file instanceof File)) return NextResponse.json({ error: "Seleccioná un archivo PFX/P12." }, { status: 400 });
    validatePkcs12Upload(file.name, file.size);
    // An empty string is meaningful for PKCS#12 and must not become undefined.
    const password = typeof rawPassword === "string" ? rawPassword : "";
    buffer = Buffer.from(await file.arrayBuffer());
    const { credentials: imported, compatibilityUsed } = await importPkcs12WithCompatibility(buffer, password);
    const current = await prisma.companySettings.findFirst();
    const data = { arcaCertificate: encryptSecret(imported.certificatePem), arcaPrivateKey: encryptSecret(imported.privateKeyPem), arcaCertificateSubject: imported.metadata.subject, arcaCertificateIssuer: imported.metadata.issuer, arcaCertificateSerial: imported.metadata.serial, arcaCertificateValidFrom: imported.metadata.validFrom, arcaCertificateValidTo: imported.metadata.validTo, arcaCredentialSource: "PKCS12" };
    const settings = await prisma.$transaction(async (tx) => {
      const saved = current ? await tx.companySettings.update({ where: { id: current.id }, data }) : await tx.companySettings.create({ data: { ...data, razonSocial: "Vase CRM", cuit: "", condicionIva: "RESPONSABLE_INSCRIPTO", puntoVentaDefault: 1 } });
      await tx.arcaCredentialFile.updateMany({ where: { environment: saved.arcaEnvironment, active: true }, data: { active: false } });
      await tx.arcaCredentialFile.create({ data: { originalFileName: file.name, fileType: "PKCS12", encryptedFileData: encryptBinary(buffer!), fileSize: file.size, environment: saved.arcaEnvironment, uploadedById: user.id, certificateSubject: imported.metadata.subject, certificateIssuer: imported.metadata.issuer, certificateSerial: imported.metadata.serial, certificateValidFrom: imported.metadata.validFrom, certificateValidTo: imported.metadata.validTo, fingerprintSha256: createHash("sha256").update(imported.certificatePem).digest("hex"), active: true } });
      return saved;
    });
    await writeAudit(user.id, "ARCA_CREDENTIAL_FILE_UPLOADED", "CompanySettings", settings.id, undefined, { source: "PKCS12", fileName: file.name, fileSize: file.size, compatibilityUsed });
    return NextResponse.json({ ok: true, compatibilityUsed, certificate: { configured: true, subject: imported.metadata.subject, issuer: imported.metadata.issuer, serial: imported.metadata.serial, validFrom: imported.metadata.validFrom, validTo: imported.metadata.validTo, privateKeyConfigured: true, source: "PKCS12" } });
  } catch (error) {
    const message = error instanceof Pkcs12ImportError ? error.message : error instanceof Error && !["FORBIDDEN", "UNAUTHENTICATED"].includes(error.message) ? error.message : "No tenés permiso para importar credenciales ARCA.";
    return NextResponse.json({ error: message, code: error instanceof Pkcs12ImportError ? error.code : undefined }, { status: message.includes("permiso") ? 403 : 400 });
  } finally { if (buffer) buffer.fill(0); }
}
