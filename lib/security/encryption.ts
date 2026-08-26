import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

export class CredentialsMasterKeyError extends Error {
  constructor(
    message = "ARCA_CREDENTIALS_MASTER_KEY debe contener 32 bytes codificados en base64.",
  ) {
    super(message);
  }
}

function masterKey() {
  const raw = process.env.ARCA_CREDENTIALS_MASTER_KEY;
  if (!raw)
    throw new CredentialsMasterKeyError(
      "Falta ARCA_CREDENTIALS_MASTER_KEY; no se pueden guardar credenciales ARCA.",
    );
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new CredentialsMasterKeyError();
  }
  if (key.length !== 32) throw new CredentialsMasterKeyError();
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `${VERSION}:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}
export function encryptBinary(value: Buffer) { return encryptSecret(value.toString("base64")); }
export function decryptBinary(value: string) { return Buffer.from(decryptSecret(value), "base64"); }

export function decryptSecret(value: string) {
  const [version, iv64, tag64, ciphertext64] = value.split(":");
  if (version !== VERSION || !iv64 || !tag64 || !ciphertext64)
    throw new Error("Formato de secreto cifrado ARCA inválido.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(iv64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptedSecret(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${VERSION}:`));
}
