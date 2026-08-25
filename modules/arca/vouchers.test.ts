import { describe, expect, it } from "vitest";
import { ARCA_VOUCHER_CODE_BY_KEY, getArcaVoucher, requiresAssociatedVoucher } from "./vouchers";

describe("catálogo WSFEv1 de comprobantes", () => {
  it("mantiene los códigos de facturas, notas y comprobantes M", () => {
    expect(ARCA_VOUCHER_CODE_BY_KEY.FACTURA_A).toBe(1);
    expect(ARCA_VOUCHER_CODE_BY_KEY.NOTA_DEBITO_B).toBe(7);
    expect(ARCA_VOUCHER_CODE_BY_KEY.NOTA_CREDITO_C).toBe(13);
    expect(ARCA_VOUCHER_CODE_BY_KEY.FACTURA_M).toBe(51);
  });

  it("bloquea FCE para la emisión simplificada", () => {
    expect(getArcaVoucher("FCE_FACTURA_A")?.code).toBe(201);
    expect(getArcaVoucher("FCE_FACTURA_A")?.testEnabled).toBe(false);
  });

  it("exige comprobante asociado para notas", () => {
    expect(requiresAssociatedVoucher("NOTA_CREDITO_A")).toBe(true);
    expect(requiresAssociatedVoucher("NOTA_DEBITO_M")).toBe(true);
    expect(requiresAssociatedVoucher("FACTURA_B")).toBe(false);
  });
});
