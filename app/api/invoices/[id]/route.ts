import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
const schema = z.object({ cuit: z.string().min(1).optional(), puntoVenta: z.coerce.number().int().positive().optional() });
function allowed(u: any, key: string) { return u.role === "ADMIN" || u.userRoles.some((x: any) => x.role.active && x.role.permissions.some((p: any) => p.permission.key === key)); }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getCurrentUser(); if (!u) return NextResponse.json({ error: "SesiÃ³n requerida" }, { status: 401 }); if (!allowed(u, "invoices.edit")) return NextResponse.json({ error: "No tenÃ©s permiso para editar facturas" }, { status: 403 });
  const id = (await params).id; const old = await prisma.invoice.findUnique({ where: { id } }); if (!old) return NextResponse.json({ error: "Factura inexistente" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Datos invÃ¡lidos" }, { status: 400 });
  const next = await prisma.invoice.update({ where: { id }, data: parsed.data }); await writeAudit(u.id, "EDITAR", "Invoice", id, { cuit: old.cuit, puntoVenta: old.puntoVenta }, parsed.data); return NextResponse.json({ data: next });
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getCurrentUser(); if (!u) return NextResponse.json({ error: "SesiÃ³n requerida" }, { status: 401 }); if (!allowed(u, "invoices.delete")) return NextResponse.json({ error: "No tenÃ©s permiso para borrar facturas" }, { status: 403 });
  const id = (await params).id; const old = await prisma.invoice.findUnique({ where: { id }, include: { allocations: true } }); if (!old) return NextResponse.json({ error: "Factura inexistente" }, { status: 404 }); if (old.allocations.length) return NextResponse.json({ error: "No se puede borrar una factura con cobros imputados" }, { status: 409 });
  await prisma.invoice.delete({ where: { id } }); await writeAudit(u.id, "BORRAR", "Invoice", id, { numero: old.numero, total: old.total, tipoFacturacion: old.tipoFacturacion }, undefined); return NextResponse.json({ data: { id } });
}
