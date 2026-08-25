import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const secret = request.headers.get("x-vase-job-secret");
  if (!process.env.INTERNAL_JOBS_SECRET || secret !== process.env.INTERNAL_JOBS_SECRET) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const now = new Date(); const until = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const orders = await prisma.workOrder.findMany({ where: { estadoProductivo: { in: ["PENDIENTE", "EN_PROCESO"] }, fechaEntrega: { lte: until } }, include: { client: true } });
  let created = 0;
  for (const order of orders) {
    const hours = (order.fechaEntrega.getTime() - now.getTime()) / 3_600_000;
    const type = hours < 0 ? "OT_OVERDUE" : hours <= 24 ? "OT_DUE_24H" : "OT_DUE_48H";
    const recipients = new Set([order.corteUsuarioId, order.armadoUsuarioId, order.produccionUsuarioId].filter(Boolean) as string[]);
    const supervisors = await prisma.user.findMany({ where: { active: true, userRoles: { some: { role: { name: { in: ["ADMIN", "ATENCION_CLIENTE"] }, active: true } } } }, select: { id: true } }); supervisors.forEach((user) => recipients.add(user.id));
    for (const userId of recipients) { const result = await prisma.notification.createMany({ data: [{ userId, type, title: hours < 0 ? `${order.numero} está vencida` : `${order.numero} vence pronto`, message: `${order.client.razonSocial} · Entrega ${order.fechaEntrega.toLocaleDateString("es-AR")}`, entityType: "WorkOrder", entityId: order.id, priority: hours < 0 ? "HIGH" : "NORMAL", deduplicationKey: `${type}:${order.id}:${userId}:${order.fechaEntrega.toISOString().slice(0, 10)}` }], skipDuplicates: true }); created += result.count; }
  }
  return NextResponse.json({ data: { created, checked: orders.length } });
}
