import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { importPkcs12, MAX_PKCS12_FILE_SIZE, Pkcs12ImportError, validatePkcs12Upload } from "./pkcs12";

function certificate(pair: forge.pki.KeyPair, expired = false) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = pair.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + (expired ? -60_000 : 86_400_000));
  const attrs = [{ name: "commonName", value: "Vase CRM test" }];
  cert.setSubject(attrs); cert.setIssuer(attrs); cert.sign(pair.privateKey, forge.md.sha256.create());
  return cert;
}
function container(password: string, options?: { noKey?: boolean; mismatch?: boolean; expired?: boolean; legacy3des?: boolean }) {
  const pair = forge.pki.rsa.generateKeyPair({ bits: 1024, workers: 0 });
  const cert = options?.mismatch ? certificate(forge.pki.rsa.generateKeyPair({ bits: 1024, workers: 0 })) : certificate(pair, options?.expired);
  const asn1 = forge.pkcs12.toPkcs12Asn1(options?.noKey ? null as any : pair.privateKey, cert, password, options?.legacy3des ? { algorithm: "3des" } : undefined);
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary");
}

describe("PKCS#12 ARCA import", () => {
  it("imports a PFX with a correct password", () => { const result = importPkcs12(container("secreto"), "secreto"); expect(result.certificatePem).toContain("BEGIN CERTIFICATE"); expect(result.privateKeyPem).toContain("BEGIN"); });
  it("accepts an explicitly empty password", () => { const result = importPkcs12(container(""), ""); expect(result.metadata.subject).toContain("Vase CRM test"); });
  it("imports a legacy 3DES PKCS#12 with an empty password", () => { const result = importPkcs12(container("", { legacy3des: true }), ""); expect(result.privateKeyPem).toContain("PRIVATE KEY"); });
  it("rejects an incorrect password", () => expect(() => importPkcs12(container("correcta"), "incorrecta")).toThrow("No se pudo abrir"));
  it("rejects a PKCS#12 without a private key", () => expect(() => importPkcs12(container("", { noKey: true }), "")).toThrow("no contiene una clave privada"));
  it("rejects an expired certificate", () => expect(() => importPkcs12(container("", { expired: true }), "")).toThrow("vencido"));
  it("rejects corrupt content", () => expect(() => importPkcs12(Buffer.from("not-a-pkcs12"), "")).toThrow(Pkcs12ImportError));
  it("rejects a certificate that does not match the private key", () => expect(() => importPkcs12(container("", { mismatch: true }), "")).toThrow("no corresponden"));
  it("validates extension and size before parsing", () => { expect(() => validatePkcs12Upload("credencial.pem", 20)).toThrow(".pfx"); expect(() => validatePkcs12Upload("credencial.p12", MAX_PKCS12_FILE_SIZE + 1)).toThrow("5 MB"); expect(() => validatePkcs12Upload("credencial.pfx", 20)).not.toThrow(); });
});
