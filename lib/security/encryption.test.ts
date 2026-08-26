import { afterEach, describe, expect, it } from "vitest";
import { decryptBinary, decryptSecret, encryptBinary, encryptSecret } from "./encryption";

const original = process.env.ARCA_CREDENTIALS_MASTER_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.ARCA_CREDENTIALS_MASTER_KEY;
  else process.env.ARCA_CREDENTIALS_MASTER_KEY = original;
});
describe("ARCA credential encryption", () => {
  it("encrypts and decrypts with unique IVs", () => {
    process.env.ARCA_CREDENTIALS_MASTER_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
    const first = encryptSecret("secret"),
      second = encryptSecret("secret");
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("secret");
  });
  it("rejects altered ciphertext", () => {
    process.env.ARCA_CREDENTIALS_MASTER_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
    const encrypted = encryptSecret("secret");
    const parts = encrypted.split(":");
    parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
  it("requires a valid master key", () => {
    delete process.env.ARCA_CREDENTIALS_MASTER_KEY;
    expect(() => encryptSecret("secret")).toThrow(
      "ARCA_CREDENTIALS_MASTER_KEY",
    );
    process.env.ARCA_CREDENTIALS_MASTER_KEY = "bad";
    expect(() => encryptSecret("secret")).toThrow();
  });
  it("cifra y recupera datos binarios sin exponerlos como texto", () => {
    process.env.ARCA_CREDENTIALS_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
    const source = Buffer.from([0, 255, 1, 64, 10]);
    const encrypted = encryptBinary(source);
    expect(encrypted).not.toContain(source.toString("base64"));
    expect(decryptBinary(encrypted)).toEqual(source);
  });
});
