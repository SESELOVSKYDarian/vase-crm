import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const itemSchema = z.object({ producto: z.string().optional(), composicion: z.string().optional(), cantidad: z.coerce.number().int().positive(), anchoMm: z.coerce.number().int().positive(), altoMm: z.coerce.number().int().positive(), precioM2: z.coerce.number().nonnegative().optional(), precioVentaUnitario: z.coerce.number().nonnegative().optional(), subtotalNeto: z.coerce.number().nonnegative().optional(), bonificacionPct: z.coerce.number().min(0).max(100).optional() });
const schema = z.object({ tipo: z.enum(["SIMPLE", "DVH"]), clienteId: z.string().min(1), titulo: z.string().trim().max(160).optional().default(""), obra: z.string().trim().optional().default(""), fechaEntrega: z.string().min(1), fechaValidez: z.string().min(1).optional(), estado: z.enum(["BORRADOR", "ENVIADO"]).default("BORRADOR"), totals: z.object({ cantidad: z.coerce.number().int().positive(), m2: z.coerce.number().nonnegative(), subtotalBruto: z.coerce.number().nonnegative(), bonificacion: z.coerce.number().nonnegative(), subtotalNeto: z.coerce.number().nonnegative(), iva: z.coerce.number().nonnegative(), total: z.coerce.number().positive() }), items: z.array(itemSchema).min(1) });
function canCreate(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) { return hasPermission(user, "quotes.create"); }

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!hasPermission(user, "quotes.view")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const status = params.get("status"); const type = params.get("type"); const clientId = params.get("clientId");
  const from = params.get("from"); const to = params.get("to");
  const page = Math.max(1, Number(params.get("page") ?? 1)); const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") ?? 15)));
  const where: any = { ...(status ? { estado: status } : { estado: { not: "ANULADO" } }), ...(type ? { tipo: type } : {}), ...(clientId ? { clientId } : {}) };
  if (from || to) where.fecha = { ...(from ? { gte: new Date(`${from}T00:00:00-03:00`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00-03:00`).getTime() + 86400000) } : {}) };
  try { const [quotes, total] = await Promise.all([prisma.quote.findMany({ where, include: { client: true, invoices: { select: { id: true, numero: true, tipoFacturacion: true, total: true } }, workOrder: { select: { id: true, numero: true } } }, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.quote.count({ where })]); return NextResponse.json({ data: quotes, count: total, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } }); }
  catch { return NextResponse.json({ error: "No se pudieron cargar los presupuestos" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!canCreate(user)) return NextResponse.json({ error: "No tenés permiso para crear presupuestos" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const data = parsed.data;
  try {
    const client = await prisma.client.findFirst({ where: { id: data.clienteId, estado: "ACTIVO" }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "El cliente seleccionado no existe o está inactivo" }, { status: 400 });
    const count = await prisma.quote.count();
    const quote = await prisma.quote.create({ data: { numero: `P-${String(count + 1001).padStart(4, "0")}`, tipo: data.tipo, fechaEntrega: new Date(`${data.fechaEntrega}T12:00:00-03:00`), clientId: data.clienteId, obra: data.obra, estado: data.estado, tipoFacturacion: "A", cantidadTotal: data.totals.cantidad, m2Total: data.totals.m2, subtotalBruto: data.totals.subtotalBruto, montoBonificacion: data.totals.bonificacion, subtotalNeto: data.totals.subtotalNeto, iva: data.totals.iva, total: data.totals.total, createdById: user.id, items: { create: data.items.map((item) => ({ productoNombre: item.producto ?? item.composicion ?? "Producto", cantidad: item.cantidad, anchoMm: item.anchoMm, altoMm: item.altoMm, precioM2Snapshot: item.precioM2 ?? item.precioVentaUnitario ?? 0, bonificacionPct: item.bonificacionPct ?? 0, subtotalNeto: item.subtotalNeto ?? 0 })) } }, include: { client: true, items: true } });
    if (data.fechaValidez) await prisma.quote.update({ where: { id: quote.id }, data: { fechaValidez: new Date(`${data.fechaValidez}T23:59:59-03:00`) } });
    await writeAudit(user.id, "CREAR", "Quote", quote.id, undefined, { numero: quote.numero, estado: quote.estado, fechaValidez: data.fechaValidez });
    return NextResponse.json({ data: quote }, { status: 201 });
  } catch { return NextResponse.json({ error: "No se pudo guardar el presupuesto" }, { status: 500 }); }
}
