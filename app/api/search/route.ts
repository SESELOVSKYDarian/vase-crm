import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ clients: [], quotes: [], workOrders: [], invoices: [], deliveryNotes: [] });
  const contains = { contains: q };
  const [clients, quotes, workOrders, invoices, deliveryNotes] = await Promise.all([
    prisma.client.findMany({ where: { OR: [{ razonSocial: contains }, { cuit: contains }, { codigoCliente: contains }] }, take: 5 }),
    prisma.quote.findMany({ where: { OR: [{ numero: contains }, { obra: contains }] }, take: 5 }),
    prisma.workOrder.findMany({ where: { OR: [{ numero: contains }, { obra: contains }] }, take: 5 }),
    prisma.invoice.findMany({ where: { numero: contains }, take: 5 }),
    prisma.deliveryNote.findMany({ where: { numero: contains }, take: 5 }),
  ]);
  return NextResponse.json({ clients, quotes, workOrders, invoices, deliveryNotes });
}
