import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import forge from "node-forge";
import { ArcaCertificateError, assertCertificateMatchesPrivateKey, validateCertificatePem, validatePrivateKeyPem } from "./certificate";

const execFileAsync = promisify(execFile);
export type Pkcs12ErrorCode = "INVALID_PASSWORD" | "UNSUPPORTED_PKCS12_ALGORITHM" | "INVALID_PKCS12" | "PRIVATE_KEY_NOT_FOUND" | "CERTIFICATE_NOT_FOUND" | "CERT_KEY_MISMATCH";
export type ImportedPkcs12Credentials = { certificatePem: string; privateKeyPem: string; certificateChainPem: string[]; metadata: ReturnType<typeof validateCertificatePem> };
export type Pkcs12ImportResult = { credentials: ImportedPkcs12Credentials; compatibilityUsed: boolean };

export class Pkcs12ImportError extends Error { constructor(public code: Pkcs12ErrorCode, message: string) { super(message); } }
export const MAX_PKCS12_FILE_SIZE = 5 * 1024 * 1024;

export function validatePkcs12Upload(name: string, size: number) {
  if (!/\.(pfx|p12)$/i.test(name)) throw new Pkcs12ImportError("INVALID_PKCS12", "El archivo debe tener extensión .pfx o .p12.");
  if (!size || size > MAX_PKCS12_FILE_SIZE) throw new Pkcs12ImportError("INVALID_PKCS12", "El archivo PFX/P12 no puede superar 5 MB.");
}

function selectCredentials(privateKeyPem: string, certificates: string[]): ImportedPkcs12Credentials {
  validatePrivateKeyPem(privateKeyPem);
  if (!certificates.length) throw new Pkcs12ImportError("CERTIFICATE_NOT_FOUND", "El archivo PFX/P12 no contiene un certificado X.509.");
  const certificatePem = certificates.find((candidate) => { try { assertCertificateMatchesPrivateKey(candidate, privateKeyPem); return true; } catch { return false; } });
  if (!certificatePem) throw new Pkcs12ImportError("CERT_KEY_MISMATCH", "El certificado y la clave privada del archivo PFX/P12 no corresponden entre sí.");
  return { certificatePem, privateKeyPem, certificateChainPem: certificates.filter((certificate) => certificate !== certificatePem), metadata: validateCertificatePem(certificatePem) };
}

export function importPkcs12(buffer: Buffer, password: string): ImportedPkcs12Credentials {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(buffer.toString("binary")));
    const container = forge.pkcs12.pkcs12FromAsn1(asn1, password);
    const keyBags = [...(container.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []), ...(container.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [])];
    const key = keyBags.find((bag) => bag.key)?.key;
    if (!key) throw new Pkcs12ImportError("PRIVATE_KEY_NOT_FOUND", "El archivo PFX/P12 no contiene una clave privada.");
    const certificates = (container.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []).filter((bag) => bag.cert).map((bag) => forge.pki.certificateToPem(bag.cert!));
    return selectCredentials(forge.pki.privateKeyToPem(key), certificates);
  } catch (error) {
    if (error instanceof Pkcs12ImportError || error instanceof ArcaCertificateError) throw error;
    throw new Pkcs12ImportError("INVALID_PASSWORD", "No se pudo abrir el archivo PFX/P12 con el parser estándar.");
  }
}

function pemBlocks(output: string, label: string) { return output.match(new RegExp(`-----BEGIN ${label}-----[\\s\\S]+?-----END ${label}-----`, "g")) ?? []; }
function opensslError(error: unknown) {
  const output = `${(error as any)?.stderr ?? ""} ${(error as any)?.message ?? ""}`.toLowerCase();
  if (output.includes("mac verify error") || output.includes("invalid password") || output.includes("mac verify failure")) return new Pkcs12ImportError("INVALID_PASSWORD", "La contraseña del archivo PFX/P12 es incorrecta.");
  if (output.includes("unsupported") || output.includes("rc2") || output.includes("provider")) return new Pkcs12ImportError("UNSUPPORTED_PKCS12_ALGORITHM", "El archivo PFX utiliza un algoritmo PKCS#12 antiguo no compatible con este servidor.");
  return new Pkcs12ImportError("INVALID_PKCS12", "El archivo PFX/P12 no es válido o está dañado.");
}

export async function importPkcs12WithOpenSsl(buffer: Buffer, password: string): Promise<ImportedPkcs12Credentials> {
  const directory = await mkdtemp(join(tmpdir(), "vase-arca-"));
  const input = join(directory, "credentials.p12");
  try {
    await writeFile(input, buffer, { mode: 0o600 });
    const { stdout } = await execFileAsync("openssl", ["pkcs12", "-legacy", "-in", input, "-nodes", "-passin", `pass:${password}`], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    const privateKeyPem = [...pemBlocks(stdout, "PRIVATE KEY"), ...pemBlocks(stdout, "RSA PRIVATE KEY"), ...pemBlocks(stdout, "EC PRIVATE KEY")][0];
    if (!privateKeyPem) throw new Pkcs12ImportError("PRIVATE_KEY_NOT_FOUND", "El archivo PFX/P12 no contiene una clave privada.");
    return selectCredentials(privateKeyPem, pemBlocks(stdout, "CERTIFICATE"));
  } catch (error) {
    if (error instanceof Pkcs12ImportError || error instanceof ArcaCertificateError) throw error;
    throw opensslError(error);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function importPkcs12WithCompatibility(buffer: Buffer, password: string): Promise<Pkcs12ImportResult> {
  try { return { credentials: importPkcs12(buffer, password), compatibilityUsed: false }; }
  catch (error) {
    if (error instanceof Pkcs12ImportError && ["PRIVATE_KEY_NOT_FOUND", "CERTIFICATE_NOT_FOUND", "CERT_KEY_MISMATCH"].includes(error.code)) throw error;
    return { credentials: await importPkcs12WithOpenSsl(buffer, password), compatibilityUsed: true };
  }
}
