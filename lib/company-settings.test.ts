import { describe, expect, it } from "vitest";
import { buildSettingsPayload } from "./company-settings";

describe("buildSettingsPayload", () => {
  it("envía sólo campos editables y conserva credenciales ya importadas", () => {
    const payload = buildSettingsPayload({ arcaEnvironment: "HOMOLOGACION", arcaCuit: "20123456789", arcaPuntoVenta: 1, puntoVentaDefault: 1, arcaCertificateConfigured: true, arcaCredentialSource: "PKCS12", arcaCertificateSubject: "CN=test", arcaLastConnectionStatus: "VERIFICADA" } as any);
    expect(payload).toMatchObject({ arcaEnvironment: "HOMOLOGACION", arcaCuit: "20123456789", arcaPuntoVenta: 1, puntoVentaDefault: 1 });
    expect(payload).not.toHaveProperty("arcaCertificateConfigured");
    expect(payload).not.toHaveProperty("arcaCredentialSource");
    expect(payload.arcaCertificate).toBeUndefined();
    expect(payload.arcaPrivateKey).toBeUndefined();
  });
  it("normaliza nulls de lectura sin invalidar el payload", () => {
    expect(buildSettingsPayload({ arcaCuit: null, razonSocial: null, cuit: null, arcaPuntoVenta: null })).toMatchObject({ arcaCuit: null, arcaPuntoVenta: null });
    expect(buildSettingsPayload({ arcaCuit: "" })).toMatchObject({ arcaCuit: null });
  });
});
