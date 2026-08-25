import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getArcaProvider } from "@/modules/arca/server";
import { ARCA_DOCUMENT_TYPES, ARCA_IVA_TYPES, ARCA_VOUCHER_TYPES } from "@/modules/arca/vouchers";

export async function GET() {
  await requirePermission("arca.connection.test");
  try {
    const { provider } = await getArcaProvider();
    const remote = await provider.getParameters();
    const remoteVoucher = new Map(remote.voucherTypes.map((item) => [item.code, item.label]));
    return NextResponse.json({
      data: ARCA_VOUCHER_TYPES.filter((item) => remoteVoucher.has(item.code)).map((item) => ({ ...item, label: remoteVoucher.get(item.code) || item.label })),
      documents: remote.documentTypes,
      ivaTypes: remote.ivaTypes,
      source: "ARCA",
    });
  } catch (error) {
    return NextResponse.json({
      data: ARCA_VOUCHER_TYPES,
      documents: ARCA_DOCUMENT_TYPES,
      ivaTypes: ARCA_IVA_TYPES,
      source: "FALLBACK",
      warning: error instanceof Error ? `Se muestran parámetros de respaldo: ${error.message}` : "Se muestran parámetros de respaldo.",
    });
  }
}
