import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ workOrderId: z.string().min(1), direccion: z.string().trim().min(3), transportista: z.string().trim().max(120).optional(), observaciones: z.string().trim().max(500).optional(), items: z.array(z.object({ productoNombre: z.string().min(1), cantidad: z.coerce.number().int().positive() })).min(1) });
function canPrepare(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, order: { operarioId: string | null; corteUsuarioId: string | null; armadoUsuarioId: string | null; produccionUsuarioId: string | null }) {
  return user.role === "ADMIN" || [order.operarioId, order.corteUsuarioId, order.armadoUsuarioId, order.produccionUsuarioId].includes(user.id) || user.userRoles.some((ur) => ur.role.active && ur.role.permissions.some((rp) => rp.permission.key === "delivery.update"));
}
export async function GET() {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  try { return NextResponse.json({ data: await prisma.deliveryNote.findMany({ include: { client: true, workOrder: true, items: true }, orderBy: { createdAt: "desc" } }) }); }
  catch { return NextResponse.json({ error: "No se pudieron cargar los remitos" }, { status: 500 }); }
}
export async function POST(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const data = parsed.data;
  try {
    const order = await prisma.workOrder.findUnique({ where: { id: data.workOrderId }, include: { client: true, items: true, deliveries: true } });
    if (!order) return NextResponse.json({ error: "La OT no existe" }, { status: 404 });
    if (!canPrepare(user, order)) return NextResponse.json({ error: "No tenés permiso para preparar este remito" }, { status: 403 });
    const requested = new Map(order.items.map((item) => [item.productoNombre, item.cantidad]));
    const delivered = new Map<string, number>();
    for (const delivery of order.deliveries) delivered.set("__total", (delivered.get("__total") ?? 0) + delivery.cantidadEntregada);
    const total = data.items.reduce((sum, item) => sum + item.cantidad, 0);
    const orderedTotal = [...requested.values()].reduce((sum, qty) => sum + qty, 0);
    const deliveredTotal = delivered.get("__total") ?? 0;
    if (total > orderedTotal - deliveredTotal) return NextResponse.json({ error: `Sólo quedan ${Math.max(0, orderedTotal - deliveredTotal)} unidades pendientes` }, { status: 400 });
    if (data.items.some((item) => !requested.has(item.productoNombre))) return NextResponse.json({ error: "El remito incluye un producto ajeno a la OT" }, { status: 400 });
    const count = await prisma.deliveryNote.count();
    const note = await prisma.deliveryNote.create({ data: { numero: `R-${String(count + 1).padStart(5, "0")}`, workOrderId: order.id, clientId: order.clientId, direccion: data.direccion, transportista: data.transportista, observaciones: data.observaciones, items: { create: data.items.map((item) => ({ productoNombre: item.productoNombre, cantidadPedida: item.cantidad, cantidadEntregada: item.cantidad })) }, }, include: { client: true, workOrder: true, items: true } });
    await writeAudit(user.id, "CREAR_BORRADOR", "DeliveryNote", note.id, undefined, { numero: note.numero, workOrderId: order.id });
    return NextResponse.json({ data: note }, { status: 201 });
  } catch { return NextResponse.json({ error: "No se pudo preparar el remito" }, { status: 500 }); }
}
