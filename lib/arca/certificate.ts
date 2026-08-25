import {
  X509Certificate,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";

export type CertificateMetadata = {
  subject: string;
  issuer: string;
  serial: string;
  validFrom: Date;
  validTo: Date;
};
export class ArcaCertificateError extends Error {}

export function validateCertificatePem(
  certificatePem: string,
): CertificateMetadata {
  try {
    const cert = new X509Certificate(certificatePem);
    const validFrom = new Date(cert.validFrom),
      validTo = new Date(cert.validTo),
      now = new Date();
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validTo.getTime()))
      throw new Error("Fechas inválidas");
    if (now < validFrom)
      throw new ArcaCertificateError("El certificado todavía no es válido.");
    if (now > validTo)
      throw new ArcaCertificateError("El certificado está vencido.");
    return {
      subject: cert.subject,
      issuer: cert.issuer,
      serial: cert.serialNumber,
      validFrom,
      validTo,
    };
  } catch (error) {
    if (error instanceof ArcaCertificateError) throw error;
    throw new ArcaCertificateError("El certificado PEM no es válido.");
  }
}

export function validatePrivateKeyPem(privateKeyPem: string) {
  try {
    return createPrivateKey(privateKeyPem);
  } catch {
    throw new ArcaCertificateError("La clave privada PEM no es válida.");
  }
}

export function assertCertificateMatchesPrivateKey(
  certificatePem: string,
  privateKeyPem: string,
) {
  try {
    const certificate = new X509Certificate(certificatePem);
    const certPublic = certificate.publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64");
    const privatePublic = createPublicKey(validatePrivateKeyPem(privateKeyPem))
      .export({ type: "spki", format: "der" })
      .toString("base64");
    if (certPublic !== privatePublic) throw new Error("different");
  } catch (error) {
    if (error instanceof ArcaCertificateError) throw error;
    throw new ArcaCertificateError(
      "El certificado y la clave privada no corresponden entre sí.",
    );
  }
}
