import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ decision: z.enum(["APROBADO", "RECHAZADO"]), observaciones: z.string().max(500).optional(), motivoRechazo: z.string().trim().max(500).optional() }).superRefine((value, ctx) => { if (value.decision === "RECHAZADO" && !value.motivoRechazo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["motivoRechazo"], message: "El motivo del rechazo es obligatorio" }); });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const allowed = hasPermission(user, "quotes.approve") || hasPermission(user, "quotes.reject");
  if (!allowed) return NextResponse.json({ error: "No tenés permiso para decidir presupuestos" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Decisión inválida" }, { status: 400 });
  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id }, include: { items: true } });
  if (!quote || quote.estado !== "ENVIADO") return NextResponse.json({ error: "Sólo se pueden decidir presupuestos enviados" }, { status: 409 });
  try {
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.update({ where: { id }, data: { estado: parsed.data.decision, observaciones: parsed.data.observaciones ?? quote.observaciones, motivoRechazo: parsed.data.decision === "RECHAZADO" ? parsed.data.motivoRechazo : null, rechazadoAt: parsed.data.decision === "RECHAZADO" ? new Date() : null, rechazadoPorId: parsed.data.decision === "RECHAZADO" ? user.id : null } });
    if (parsed.data.decision !== "APROBADO") return { quote: updated, workOrder: null };
    const existing = await tx.workOrder.findUnique({ where: { quoteId: id } });
    if (existing) return { quote: updated, workOrder: existing };
    const order = await tx.workOrder.create({ data: { numero: `OT-${Date.now()}`, quoteId: quote.id, clientId: quote.clientId, obra: quote.obra, categoria: quote.tipo === "DVH" ? "DVH" : "SIMPLE", fechaEntrega: quote.fechaEntrega, items: { create: quote.items.map((item) => ({ productoNombre: item.productoNombre, cantidad: item.cantidad, anchoMm: item.anchoMm, altoMm: item.altoMm, m2: Number(item.anchoMm * item.altoMm * item.cantidad) / 1_000_000 })) } } });
    await tx.cutOrder.create({ data: { workOrderId: order.id } });
    if (quote.tipo === "DVH") await tx.assemblyOrder.create({ data: { workOrderId: order.id } });
    return { quote: updated, workOrder: order };
  });
  await writeAudit(user.id, parsed.data.decision === "APROBADO" ? "APROBAR" : "RECHAZAR", "Quote", id, { estado: "ENVIADO" }, { estado: parsed.data.decision, workOrderId: result.workOrder?.id });
  return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[quotes/decision]", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : "La base de datos no pudo crear la OT. Verificá la migración Prisma y los datos del presupuesto.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
