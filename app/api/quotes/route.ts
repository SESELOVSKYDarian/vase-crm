import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const itemSchema = z.object({ producto: z.string().optional(), composicion: z.string().optional(), cantidad: z.coerce.number().int().positive(), anchoMm: z.coerce.number().int().positive(), altoMm: z.coerce.number().int().positive(), precioM2: z.coerce.number().nonnegative().optional(), precioVentaUnitario: z.coerce.number().nonnegative().optional(), subtotalNeto: z.coerce.number().nonnegative().optional(), bonificacionPct: z.coerce.number().min(0).max(100).optional() });
const schema = z.object({ tipo: z.enum(["SIMPLE", "DVH"]), clienteId: z.string().min(1), obra: z.string().trim().min(2), fechaEntrega: z.string().min(1), estado: z.enum(["BORRADOR", "ENVIADO"]).default("BORRADOR"), totals: z.object({ cantidad: z.coerce.number().int().positive(), m2: z.coerce.number().nonnegative(), subtotalBruto: z.coerce.number().nonnegative(), bonificacion: z.coerce.number().nonnegative(), subtotalNeto: z.coerce.number().nonnegative(), iva: z.coerce.number().nonnegative(), total: z.coerce.number().positive() }), items: z.array(itemSchema).min(1) });
function canCreate(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) { return user.role === "ADMIN" || user.role === "VENTAS" || user.userRoles.some((ur) => ur.role.active && ur.role.permissions.some((rp) => rp.permission.key === "quotes.create")); }

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status");
  try { const quotes = await prisma.quote.findMany({ where: status ? { estado: status as never } : { estado: { not: "ANULADO" } }, include: { client: true, workOrder: { select: { id: true, numero: true } } }, orderBy: { updatedAt: "desc" } }); return NextResponse.json({ data: quotes }); }
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
    await writeAudit(user.id, "CREAR", "Quote", quote.id, undefined, { numero: quote.numero, estado: quote.estado });
    return NextResponse.json({ data: quote }, { status: 201 });
  } catch { return NextResponse.json({ error: "No se pudo guardar el presupuesto" }, { status: 500 }); }
}
