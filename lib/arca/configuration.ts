import type { Prisma } from "@prisma/client";

export const arcaConnectionReset = {
  arcaLastConnectionTestAt: null,
  arcaLastConnectionStatus: "SIN_CONFIGURAR",
  arcaLastConnectionMessage: null,
} as const;

export const arcaCredentialReset = {
  arcaCertificate: null,
  arcaPrivateKey: null,
  arcaCertificateSubject: null,
  arcaCertificateIssuer: null,
  arcaCertificateSerial: null,
  arcaCertificateValidFrom: null,
  arcaCertificateValidTo: null,
  arcaCredentialSource: null,
} as const;

export const arcaConfigurationReset = {
  arcaCuit: null,
  arcaPuntoVenta: null,
  ...arcaCredentialReset,
  ...arcaConnectionReset,
} as const;

export async function invalidateArcaTickets(tx: Prisma.TransactionClient) {
  return tx.arcaAccessTicket.deleteMany({});
}
