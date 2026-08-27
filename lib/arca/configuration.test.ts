import { describe, expect, it } from "vitest";
import { arcaConfigurationReset, arcaConnectionReset, arcaCredentialReset } from "./configuration";

describe("ARCA configuration reset", () => {
  it("clears all credential, identity and connection fields without touching fiscal records", () => {
    expect(arcaConfigurationReset).toMatchObject({
      arcaCuit: null,
      arcaPuntoVenta: null,
      arcaCertificate: null,
      arcaPrivateKey: null,
      arcaCredentialSource: null,
      arcaLastConnectionTestAt: null,
      arcaLastConnectionStatus: "SIN_CONFIGURAR",
      arcaLastConnectionMessage: null,
    });
    expect(arcaConfigurationReset).toMatchObject(arcaCredentialReset);
    expect(arcaConfigurationReset).toMatchObject(arcaConnectionReset);
  });
});
