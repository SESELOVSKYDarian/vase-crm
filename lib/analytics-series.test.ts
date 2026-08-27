import { describe, expect, it } from "vitest";
import { chartNumber, normalizedMonthlySeries } from "@/lib/analytics-series";

describe("chart series", () => {
  it("converts Decimal-like values and prevents invalid SVG values", () => {
    expect(chartNumber({ toString: () => "1250.50" })).toBe(1250.5);
    expect(chartNumber("123.45")).toBe(123.45);
    expect(chartNumber(42)).toBe(42);
    expect(chartNumber(null)).toBe(0);
    expect(chartNumber(undefined)).toBe(0);
    expect(chartNumber(Number.NaN)).toBe(0);
    expect(chartNumber("not-a-number")).toBe(0);
    expect(normalizedMonthlySeries([{ label: "Ago", presupuestado: "50", facturado: 30, cobrado: null }])).toEqual([{ label: "Ago", presupuestado: 50, facturado: 30, cobrado: 0 }]);
  });
});
