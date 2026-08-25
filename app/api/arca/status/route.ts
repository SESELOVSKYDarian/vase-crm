import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function GET() {
  if (!(await getCurrentUser()))
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const settings = await prisma.companySettings.findFirst();
  const tests = await prisma.arcaConnectionTest.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
  return NextResponse.json({
    data: {
      environment: settings?.arcaEnvironment ?? "HOMOLOGACION",
      cuit: settings?.arcaCuit ?? null,
      puntoVenta: settings?.arcaPuntoVenta ?? null,
      certificateConfigured: Boolean(settings?.arcaCertificate),
      privateKeyConfigured: Boolean(settings?.arcaPrivateKey),
      credentialSource: settings?.arcaCredentialSource ?? null,
      certificate: settings?.arcaCertificateSubject
        ? {
            subject: settings.arcaCertificateSubject,
            issuer: settings.arcaCertificateIssuer,
            serial: settings.arcaCertificateSerial,
            validFrom: settings.arcaCertificateValidFrom,
            validTo: settings.arcaCertificateValidTo,
          }
        : null,
      lastConnection: settings?.arcaLastConnectionStatus
        ? {
            status: settings.arcaLastConnectionStatus,
            at: settings.arcaLastConnectionTestAt,
            message: settings.arcaLastConnectionMessage,
          }
        : null,
      tests,
    },
  });
}
