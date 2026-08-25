import { prisma } from "@/lib/prisma";
import { decryptSecret, isEncryptedSecret } from "@/lib/security/encryption";
import { ArcaConfigurationError } from "./errors";
import { WsfeArcaProvider } from "./providers/WsfeArcaProvider";

export async function getArcaProvider() {
  const settings = await prisma.companySettings.findFirst();
  if (!settings?.arcaCuit || !settings.arcaPuntoVenta)
    throw new ArcaConfigurationError("Completá CUIT y punto de venta ARCA.");
  if (
    settings.arcaEnvironment === "PRODUCCION" &&
    process.env.ARCA_PRODUCTION_ENABLED !== "true"
  )
    throw new ArcaConfigurationError("Producción está bloqueada por Vase.");
  if (!settings.arcaCertificate || !settings.arcaPrivateKey)
    throw new ArcaConfigurationError(
      "Configurá el certificado y la clave privada ARCA.",
    );
  if (
    !isEncryptedSecret(settings.arcaCertificate) ||
    !isEncryptedSecret(settings.arcaPrivateKey)
  )
    throw new ArcaConfigurationError(
      "Las credenciales ARCA existentes deben migrarse a formato cifrado.",
    );
  return {
    settings,
    provider: new WsfeArcaProvider(
      settings.arcaEnvironment as "HOMOLOGACION" | "PRODUCCION",
      settings.arcaCuit,
      decryptSecret(settings.arcaCertificate),
      decryptSecret(settings.arcaPrivateKey),
      settings.arcaService,
    ),
  };
}
