import { describe, expect, it } from "vitest";
import { isValidCuit, normalizeCuit } from "./cuit";
describe("CUIT", () => {
  it("normalizes hyphens", () =>
    expect(normalizeCuit("20-12345678-6")).toBe("20123456786"));
  it("accepts a valid CUIT", () =>
    expect(isValidCuit("20-12345678-6")).toBe(true));
  it("rejects an invalid check digit", () =>
    expect(isValidCuit("20-12345678-9")).toBe(false));
});
