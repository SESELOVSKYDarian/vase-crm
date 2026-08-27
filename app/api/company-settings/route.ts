import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { encryptSecret, isEncryptedSecret } from "@/lib/security/encryption";
import { assertCertificateMatchesPrivateKey, validateCertificatePem, validatePrivateKeyPem } from "@/lib/arca/certificate";
import { isValidCuit, normalizeCuit } from "@/lib/arca/cuit";
import { arcaConnectionReset, invalidateArcaTickets } from "@/lib/arca/configuration";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/csrf";

const nullableText = z.string().trim().nullable().optional().transform((value) => value === "" ? null : value);
const schema = z.object({
  logoData: z.string().nullable().optional(),
  razonSocial: z.string().trim().min(2).optional(),
  cuit: z.string().trim().optional(),
  puntoVentaDefault: z.coerce.number().int().positive().optional(),
  arcaEnvironment: z.enum(["HOMOLOGACION", "PRODUCCION"]).optional(),
  arcaCuit: nullableText,
  arcaPuntoVenta: z.coerce.number().int().positive().nullable().optional(),
  arcaCertificate: z.string().max(200000).nullable().optional(),
  arcaPrivateKey: z.string().max(200000).nullable().optional(),
  deleteArcaCertificate: z.boolean().optional(),
  deleteArcaPrivateKey: z.boolean().optional(),
});

const responseSettings = (settings: any) => settings && ({
  id: settings.id, logoData: settings.logoData, razonSocial: settings.razonSocial,
  cuit: settings.cuit, puntoVentaDefault: settings.puntoVentaDefault,
  arcaEnvironment: settings.arcaEnvironment, arcaCuit: settings.arcaCuit,
  arcaPuntoVenta: settings.arcaPuntoVenta,
  arcaCertificateConfigured: Boolean(settings.arcaCertificate),
  arcaPrivateKeyConfigured: Boolean(settings.arcaPrivateKey),
  arcaCertificateSubject: settings.arcaCertificateSubject,
  arcaCertificateIssuer: settings.arcaCertificateIssuer,
  arcaCertificateSerial: settings.arcaCertificateSerial,
  arcaCertificateValidFrom: settings.arcaCertificateValidFrom,
  arcaCertificateValidTo: settings.arcaCertificateValidTo,
  arcaCredentialSource: settings.arcaCredentialSource,
  arcaLastConnectionTestAt: settings.arcaLastConnectionTestAt,
  arcaLastConnectionStatus: settings.arcaLastConnectionStatus,
  arcaLastConnectionMessage: settings.arcaLastConnectionMessage,
});

export async function GET() {
  try { return NextResponse.json({ data: responseSettings(await prisma.companySettings.findFirst()) }); }
  catch { return NextResponse.json({ error: "No se pudo cargar la configuración." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  let user: any;
  try {
    assertSameOrigin(request);
    user = await requirePermission("company.settings.manage");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos de configuración inválidos.", fields: process.env.NODE_ENV !== "production" ? parsed.error.flatten().fieldErrors : undefined }, { status: 400 });
    const body = parsed.data;
    if (body.arcaEnvironment === "PRODUCCION" && process.env.ARCA_PRODUCTION_ENABLED !== "true") return NextResponse.json({ error: "Producción está bloqueada por Vase. Configurá sólo homologación por el momento." }, { status: 403 });
    if (body.logoData && (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(body.logoData) || body.logoData.length > 2800000)) return NextResponse.json({ error: "El logo debe ser PNG, JPG o WEBP y no superar 2 MB." }, { status: 400 });
    if (typeof body.arcaCuit === "string" && !isValidCuit(body.arcaCuit)) return NextResponse.json({ error: "El CUIT ARCA no es válido." }, { status: 400 });

    const current = await prisma.companySettings.findFirst();
    const suppliedCertificate = typeof body.arcaCertificate === "string" && body.arcaCertificate.trim() ? body.arcaCertificate.trim() : undefined;
    const suppliedKey = typeof body.arcaPrivateKey === "string" && body.arcaPrivateKey.trim() ? body.arcaPrivateKey.trim() : undefined;
    let metadata: any = {};
    if (suppliedCertificate) metadata = validateCertificatePem(suppliedCertificate);
    if (suppliedKey) validatePrivateKeyPem(suppliedKey);
    if ((suppliedCertificate || suppliedKey) && !(body.deleteArcaCertificate || body.deleteArcaPrivateKey)) {
      const { decryptSecret } = await import("@/lib/security/encryption");
      if (suppliedCertificate && suppliedKey) assertCertificateMatchesPrivateKey(suppliedCertificate, suppliedKey);
      else if (suppliedCertificate && current?.arcaPrivateKey && isEncryptedSecret(current.arcaPrivateKey)) assertCertificateMatchesPrivateKey(suppliedCertificate, decryptSecret(current.arcaPrivateKey));
      else if (suppliedKey && current?.arcaCertificate && isEncryptedSecret(current.arcaCertificate)) assertCertificateMatchesPrivateKey(decryptSecret(current.arcaCertificate), suppliedKey);
    }

    const data: Record<string, unknown> = {};
    const copy = ["logoData", "razonSocial", "cuit", "puntoVentaDefault", "arcaEnvironment", "arcaPuntoVenta"] as const;
    for (const key of copy) if (body[key] !== undefined) data[key] = body[key];
    if (body.arcaCuit !== undefined) data.arcaCuit = body.arcaCuit === null ? null : normalizeCuit(body.arcaCuit);
    if (body.deleteArcaCertificate || body.arcaCertificate === null) Object.assign(data, { arcaCertificate: null, arcaCertificateSubject: null, arcaCertificateIssuer: null, arcaCertificateSerial: null, arcaCertificateValidFrom: null, arcaCertificateValidTo: null, arcaCredentialSource: null });
    else if (suppliedCertificate) Object.assign(data, { arcaCertificate: encryptSecret(suppliedCertificate), arcaCertificateSubject: metadata.subject, arcaCertificateIssuer: metadata.issuer, arcaCertificateSerial: metadata.serial, arcaCertificateValidFrom: metadata.validFrom, arcaCertificateValidTo: metadata.validTo, arcaCredentialSource: "MANUAL" });
    if (body.deleteArcaPrivateKey || body.arcaPrivateKey === null) { data.arcaPrivateKey = null; data.arcaCredentialSource = null; }
    else if (suppliedKey) { data.arcaPrivateKey = encryptSecret(suppliedKey); data.arcaCredentialSource = "MANUAL"; }

    const arcaChanged = ["arcaEnvironment", "arcaCuit", "arcaPuntoVenta", "arcaCertificate", "arcaPrivateKey"].some((key) => key in data);
    if (arcaChanged) Object.assign(data, arcaConnectionReset);
    const settings = await prisma.$transaction(async (tx) => {
      const saved = current ? await tx.companySettings.update({ where: { id: current.id }, data }) : await tx.companySettings.create({ data: { ...data, razonSocial: String(data.razonSocial ?? "Vase CRM"), cuit: String(data.cuit ?? ""), condicionIva: "RESPONSABLE_INSCRIPTO", puntoVentaDefault: Number(data.puntoVentaDefault ?? 1) } });
      if (arcaChanged) {
        await invalidateArcaTickets(tx);
        if (body.deleteArcaCertificate || body.deleteArcaPrivateKey || body.arcaCertificate === null || body.arcaPrivateKey === null) await tx.arcaCredentialFile.deleteMany({ where: { active: true } });
      }
      return saved;
    });
    const actions = [body.arcaCuit === null && "ARCA_CUIT_CLEARED", body.arcaPuntoVenta === null && "ARCA_POINT_OF_SALE_CLEARED", (body.deleteArcaCertificate || body.arcaCertificate === null) && "ARCA_CERTIFICATE_DELETED", (body.deleteArcaPrivateKey || body.arcaPrivateKey === null) && "ARCA_PRIVATE_KEY_DELETED", arcaChanged && "ARCA_ACCESS_TICKETS_INVALIDATED"].filter(Boolean) as string[];
    for (const action of actions.length ? actions : ["ARCA_SETTINGS_UPDATED"]) await writeAudit(user.id, action, "CompanySettings", settings.id, undefined, { arcaChanged, environment: settings.arcaEnvironment });
    return NextResponse.json({ data: responseSettings(settings) });
  } catch (error) {
    const message = error instanceof Error && !["FORBIDDEN", "UNAUTHENTICATED"].includes(error.message) ? error.message : "No tenés permiso para cambiar la configuración.";
    return NextResponse.json({ error: message }, { status: message.includes("permiso") ? 403 : 400 });
  }
}
