import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const orders = await prisma.workOrder.findMany({ include: { client: true, items: true, deliveries: true }, orderBy: { fechaEntrega: "asc" } });
    return NextResponse.json({ data: orders.map((order) => ({ ...order, cantidadTotal: order.items.reduce((sum, item) => sum + item.cantidad, 0), cantidadEntregada: order.deliveries.reduce((sum, delivery) => sum + delivery.cantidadEntregada, 0) })) });
  } catch { return NextResponse.json({ error: "No se pudieron cargar las órdenes" }, { status: 500 }); }
}
