import forge from "node-forge";
import {
  ArcaCertificateError,
  assertCertificateMatchesPrivateKey,
  validateCertificatePem,
  validatePrivateKeyPem,
} from "./certificate";

export type ImportedPkcs12Credentials = {
  certificatePem: string;
  privateKeyPem: string;
  certificateChainPem: string[];
  metadata: ReturnType<typeof validateCertificatePem>;
};

export class Pkcs12ImportError extends Error {}

export const MAX_PKCS12_FILE_SIZE = 5 * 1024 * 1024;

export function validatePkcs12Upload(name: string, size: number) {
  if (!/\.(pfx|p12)$/i.test(name)) throw new Pkcs12ImportError("El archivo debe tener extensión .pfx o .p12.");
  if (!size || size > MAX_PKCS12_FILE_SIZE) throw new Pkcs12ImportError("El archivo PFX/P12 no puede superar 5 MB.");
}

export function importPkcs12(buffer: Buffer, password: string): ImportedPkcs12Credentials {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(buffer.toString("binary")));
    const container = forge.pkcs12.pkcs12FromAsn1(asn1, password);
    const keyBags = [
      ...(container.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
      ...(container.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
    ];
    const certBags = container.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
    const key = keyBags.find((bag) => bag.key)?.key;
    if (!key) throw new Pkcs12ImportError("El archivo PFX/P12 no contiene una clave privada.");
    const privateKeyPem = forge.pki.privateKeyToPem(key);
    validatePrivateKeyPem(privateKeyPem);
    const certificates = certBags.filter((bag) => bag.cert).map((bag) => forge.pki.certificateToPem(bag.cert!));
    if (!certificates.length) throw new Pkcs12ImportError("El archivo PFX/P12 no contiene un certificado X.509.");
    const certificatePem = certificates.find((candidate) => {
      try { assertCertificateMatchesPrivateKey(candidate, privateKeyPem); return true; } catch { return false; }
    });
    if (!certificatePem) throw new Pkcs12ImportError("El certificado y la clave privada del archivo PFX/P12 no corresponden entre sí.");
    const metadata = validateCertificatePem(certificatePem);
    return { certificatePem, privateKeyPem, certificateChainPem: certificates.filter((certificate) => certificate !== certificatePem), metadata };
  } catch (error) {
    if (error instanceof Pkcs12ImportError || error instanceof ArcaCertificateError) throw error;
    throw new Pkcs12ImportError("No se pudo abrir el archivo PFX/P12. Verificá la contraseña.");
  }
}
