import type { ArcaVoucherType } from "@/modules/arca/types";

export type AdjustmentKind = "NOTA_CREDITO" | "NOTA_DEBITO";

export function relatedVoucherType(original: ArcaVoucherType | null, kind: AdjustmentKind): ArcaVoucherType {
  const group = original?.replace("FACTURA_", "") ?? "A";
  const key = `${kind}_${group}` as ArcaVoucherType;
  const accepted: ArcaVoucherType[] = ["NOTA_CREDITO_A", "NOTA_CREDITO_B", "NOTA_CREDITO_C", "NOTA_CREDITO_M", "NOTA_DEBITO_A", "NOTA_DEBITO_B", "NOTA_DEBITO_C", "NOTA_DEBITO_M"];
  if (!accepted.includes(key)) throw new Error("UNSUPPORTED_VOUCHER_TYPE");
  return key;
}

export function remainingCredit(originalTotal: number, authorizedCredits: number) {
  return Math.max(0, round(originalTotal - authorizedCredits));
}

export function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

export function totalsFromItems(items: Array<{ quantity: number; price: number }>, taxRate = 0.21) {
  const subtotal = round(items.reduce((sum, item) => sum + item.quantity * item.price, 0));
  const iva = round(subtotal * taxRate);
  return { subtotal, iva, tributos: 0, total: round(subtotal + iva) };
}
