import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { ArcaConfigurationError } from "../errors";
const execFileAsync = promisify(execFile);

export async function signTra(
  tra: string,
  certificate: string,
  privateKey: string,
) {
  const directory = await mkdtemp(join(tmpdir(), "vase-arca-"));
  const traFile = join(directory, "tra.xml"),
    certFile = join(directory, "cert.pem"),
    keyFile = join(directory, "key.pem"),
    cmsFile = join(directory, "cms.der");
  try {
    await Promise.all([
      writeFile(traFile, tra, { mode: 0o600 }),
      writeFile(certFile, certificate, { mode: 0o600 }),
      writeFile(keyFile, privateKey, { mode: 0o600 }),
    ]);
    await chmod(directory, 0o700);
    await execFileAsync(
      "openssl",
      [
        "cms",
        "-sign",
        "-in",
        traFile,
        "-signer",
        certFile,
        "-inkey",
        keyFile,
        "-outform",
        "DER",
        "-out",
        cmsFile,
        "-nodetach",
        "-binary",
      ],
      { timeout: Number(process.env.ARCA_HTTP_TIMEOUT_MS ?? 15000) },
    );
    return (
      await (await import("node:fs/promises")).readFile(cmsFile)
    ).toString("base64");
  } catch {
    throw new ArcaConfigurationError(
      "No se pudo firmar el Ticket de Requerimiento de Acceso con el certificado configurado.",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
