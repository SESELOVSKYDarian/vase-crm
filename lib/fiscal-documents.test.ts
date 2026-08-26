import { describe, expect, it } from "vitest";
import { relatedVoucherType, remainingCredit, totalsFromItems } from "@/lib/fiscal-documents";

describe("fiscal adjustments", () => {
  it("maps credit and debit notes to the original ARCA group", () => {
    expect(relatedVoucherType("FACTURA_A", "NOTA_CREDITO")).toBe("NOTA_CREDITO_A");
    expect(relatedVoucherType("FACTURA_A", "NOTA_DEBITO")).toBe("NOTA_DEBITO_A");
    expect(relatedVoucherType("FACTURA_M", "NOTA_CREDITO")).toBe("NOTA_CREDITO_M");
  });
  it("never allows credits over the remaining balance", () => {
    expect(remainingCredit(100, 30)).toBe(70);
    expect(remainingCredit(100, 130)).toBe(0);
  });
  it("calculates partial note totals from original items", () => {
    expect(totalsFromItems([{ quantity: 4, price: 100 }])).toEqual({ subtotal: 400, iva: 84, tributos: 0, total: 484 });
  });
});
