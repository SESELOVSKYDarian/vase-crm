import { PrismaClient } from "@prisma/client";
import { encryptSecret, isEncryptedSecret } from "../lib/security/encryption";
import { validateCertificatePem } from "../lib/arca/certificate";

const prisma = new PrismaClient();
async function main() {
  const settings = await prisma.companySettings.findFirst();
  if (!settings) return;
  const data: Record<string, unknown> = {};
  if (settings.arcaCertificate && !isEncryptedSecret(settings.arcaCertificate)) {
    const metadata = validateCertificatePem(settings.arcaCertificate);
    data.arcaCertificate = encryptSecret(settings.arcaCertificate);
    data.arcaCertificateSubject = metadata.subject;
    data.arcaCertificateIssuer = metadata.issuer;
    data.arcaCertificateSerial = metadata.serial;
    data.arcaCertificateValidFrom = metadata.validFrom;
    data.arcaCertificateValidTo = metadata.validTo;
  }
  if (settings.arcaPrivateKey && !isEncryptedSecret(settings.arcaPrivateKey)) data.arcaPrivateKey = encryptSecret(settings.arcaPrivateKey);
  if (Object.keys(data).length) await prisma.companySettings.update({ where: { id: settings.id }, data });
}
main().finally(() => prisma.$disconnect());

