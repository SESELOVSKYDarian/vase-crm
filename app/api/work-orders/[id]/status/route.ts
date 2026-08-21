import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workOrderStatusSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission("production.work_order.status.update"); } catch (error: any) { return NextResponse.json({ error: error.message === "FORBIDDEN" ? "No tenés permiso para mover órdenes" : "Sesión requerida" }, { status: error.message === "FORBIDDEN" ? 403 : 401 }); }
  const parsed = workOrderStatusSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  try { return NextResponse.json(await prisma.workOrder.update({ where: { id: (await params).id }, data: { estadoProductivo: parsed.data.status } })); }
  catch { return NextResponse.json({ error: "No se pudo guardar el estado" }, { status: 500 }); }
}
