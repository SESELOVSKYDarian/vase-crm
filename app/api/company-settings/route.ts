import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { encryptSecret, isEncryptedSecret } from "@/lib/security/encryption";
import {
  assertCertificateMatchesPrivateKey,
  validateCertificatePem,
  validatePrivateKeyPem,
} from "@/lib/arca/certificate";
import { isValidCuit, normalizeCuit } from "@/lib/arca/cuit";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security/csrf";

const schema = z.object({
  logoData: z.string().nullable().optional(),
  razonSocial: z.string().trim().min(2).optional(),
  cuit: z.string().trim().optional(),
  puntoVentaDefault: z.coerce.number().int().positive().optional(),
  arcaEnvironment: z.enum(["HOMOLOGACION", "PRODUCCION"]).optional(),
  arcaCuit: z.string().trim().optional(),
  arcaPuntoVenta: z.coerce.number().int().positive().nullable().optional(),
  arcaCertificate: z.string().max(200000).optional(),
  arcaPrivateKey: z.string().max(200000).optional(),
  deleteArcaCertificate: z.boolean().optional(),
  deleteArcaPrivateKey: z.boolean().optional(),
});

const responseSettings = (settings: any) =>
  settings && {
    id: settings.id,
    logoData: settings.logoData,
    razonSocial: settings.razonSocial,
    cuit: settings.cuit,
    puntoVentaDefault: settings.puntoVentaDefault,
    arcaEnvironment: settings.arcaEnvironment,
    arcaCuit: settings.arcaCuit,
    arcaPuntoVenta: settings.arcaPuntoVenta,
    arcaCertificateConfigured: Boolean(settings.arcaCertificate),
    arcaPrivateKeyConfigured: Boolean(settings.arcaPrivateKey),
    arcaCertificateSubject: settings.arcaCertificateSubject,
    arcaCertificateIssuer: settings.arcaCertificateIssuer,
    arcaCertificateSerial: settings.arcaCertificateSerial,
    arcaCertificateValidFrom: settings.arcaCertificateValidFrom,
    arcaCertificateValidTo: settings.arcaCertificateValidTo,
    arcaLastConnectionTestAt: settings.arcaLastConnectionTestAt,
    arcaLastConnectionStatus: settings.arcaLastConnectionStatus,
    arcaLastConnectionMessage: settings.arcaLastConnectionMessage,
  };

export async function GET() {
  try {
    return NextResponse.json({
      data: responseSettings(await prisma.companySettings.findFirst()),
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar la configuración." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let user: any;
  try {
    assertSameOrigin(request);
    user = await requirePermission("company.settings.manage");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Datos de configuración inválidos." },
        { status: 400 },
      );
    const body = parsed.data;
    if (
      body.arcaEnvironment === "PRODUCCION" &&
      process.env.ARCA_PRODUCTION_ENABLED !== "true"
    )
      return NextResponse.json(
        {
          error:
            "Producción está bloqueada por Vase. Configurá sólo homologación por el momento.",
        },
        { status: 403 },
      );
    if (
      body.logoData &&
      (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(body.logoData) ||
        body.logoData.length > 2800000)
    )
      return NextResponse.json(
        { error: "El logo debe ser PNG, JPG o WEBP y no superar 2 MB." },
        { status: 400 },
      );
    if (body.arcaCuit && !isValidCuit(body.arcaCuit))
      return NextResponse.json(
        { error: "El CUIT ARCA no es válido." },
        { status: 400 },
      );
    const current = await prisma.companySettings.findFirst();
    const currentCertificate = current?.arcaCertificate;
    const currentKey = current?.arcaPrivateKey;
    const suppliedCertificate = body.arcaCertificate?.trim() || undefined;
    const suppliedKey = body.arcaPrivateKey?.trim() || undefined;
    let metadata: any = {};
    if (suppliedCertificate)
      metadata = validateCertificatePem(suppliedCertificate);
    if (suppliedKey) validatePrivateKeyPem(suppliedKey);
    if (
      (suppliedCertificate || suppliedKey) &&
      !(body.deleteArcaCertificate || body.deleteArcaPrivateKey)
    ) {
      if (suppliedCertificate && suppliedKey)
        assertCertificateMatchesPrivateKey(suppliedCertificate, suppliedKey);
      else if (
        suppliedCertificate &&
        currentKey &&
        isEncryptedSecret(currentKey)
      ) {
        const { decryptSecret } = await import("@/lib/security/encryption");
        assertCertificateMatchesPrivateKey(
          suppliedCertificate,
          decryptSecret(currentKey),
        );
      } else if (
        suppliedKey &&
        currentCertificate &&
        isEncryptedSecret(currentCertificate)
      ) {
        const { decryptSecret } = await import("@/lib/security/encryption");
        assertCertificateMatchesPrivateKey(
          decryptSecret(currentCertificate),
          suppliedKey,
        );
      }
    }
    const data: any = {
      logoData: body.logoData,
      razonSocial: body.razonSocial,
      cuit: body.cuit,
      puntoVentaDefault: body.puntoVentaDefault,
      arcaEnvironment: body.arcaEnvironment,
      arcaCuit: body.arcaCuit ? normalizeCuit(body.arcaCuit) : undefined,
      arcaPuntoVenta: body.arcaPuntoVenta,
    };
    Object.keys(data).forEach(
      (key) => data[key] === undefined && delete data[key],
    );
    if (body.deleteArcaCertificate)
      Object.assign(data, {
        arcaCertificate: null,
        arcaCertificateSubject: null,
        arcaCertificateIssuer: null,
        arcaCertificateSerial: null,
        arcaCertificateValidFrom: null,
        arcaCertificateValidTo: null,
      });
    else if (suppliedCertificate)
      Object.assign(data, {
        arcaCertificate: encryptSecret(suppliedCertificate),
        arcaCertificateSubject: metadata.subject,
        arcaCertificateIssuer: metadata.issuer,
        arcaCertificateSerial: metadata.serial,
        arcaCertificateValidFrom: metadata.validFrom,
        arcaCertificateValidTo: metadata.validTo,
      });
    if (body.deleteArcaPrivateKey) data.arcaPrivateKey = null;
    else if (suppliedKey) data.arcaPrivateKey = encryptSecret(suppliedKey);
    const settings = current
      ? await prisma.companySettings.update({ where: { id: current.id }, data })
      : await prisma.companySettings.create({
          data: {
            ...data,
            razonSocial: data.razonSocial ?? "Vase CRM",
            cuit: data.cuit ?? "",
            condicionIva: "RESPONSABLE_INSCRIPTO",
            puntoVentaDefault: data.puntoVentaDefault ?? 1,
          },
        });
    const actions = [
      suppliedCertificate && "ARCA_CERTIFICATE_REPLACED",
      suppliedKey && "ARCA_PRIVATE_KEY_REPLACED",
      (body.deleteArcaCertificate || body.deleteArcaPrivateKey) &&
        "ARCA_CREDENTIALS_DELETED",
    ].filter(Boolean);
    for (const action of actions.length ? actions : ["ARCA_SETTINGS_UPDATED"])
      await writeAudit(
        user.id,
        action as string,
        "CompanySettings",
        settings.id,
        undefined,
        { environment: settings.arcaEnvironment },
      );
    return NextResponse.json({ data: responseSettings(settings) });
  } catch (error) {
    const message =
      error instanceof Error &&
      !["FORBIDDEN", "UNAUTHENTICATED"].includes(error.message)
        ? error.message
        : "No tenés permiso para cambiar la configuración.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("permiso") ? 403 : 400 },
    );
  }
}
