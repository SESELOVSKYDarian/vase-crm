import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const updateSchema = z.object({ obra: z.string().trim().optional(), fechaEntrega: z.string().min(1).optional(), observaciones: z.string().max(500).nullable().optional() });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const quote = await prisma.quote.findUnique({ where: { id: (await params).id }, include: { items: true, client: true, workOrder: true } });
  if (!quote) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  return NextResponse.json({ data: quote });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const id = (await params).id; const before = await prisma.quote.findUnique({ where: { id } });
  if (!before || before.estado !== "BORRADOR") return NextResponse.json({ error: "Sólo se pueden editar borradores" }, { status: 409 });
  const quote = await prisma.quote.update({ where: { id }, data: { ...parsed.data, fechaEntrega: parsed.data.fechaEntrega ? new Date(`${parsed.data.fechaEntrega}T12:00:00-03:00`) : undefined } });
  await writeAudit(user.id, "EDITAR", "Quote", id, before, quote); return NextResponse.json({ data: quote });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  try { const id = (await params).id; const before = await prisma.quote.findUnique({ where: { id } }); if (!before || before.estado !== "BORRADOR") return NextResponse.json({ error: "Sólo se pueden eliminar borradores" }, { status: 409 }); const quote = await prisma.quote.update({ where: { id }, data: { estado: "ANULADO" } }); await writeAudit(user.id, "ANULAR", "Quote", id, { estado: before.estado }, { estado: quote.estado }); return NextResponse.json({ data: { ok: true } }); }
  catch { return NextResponse.json({ error: "No se pudo borrar" }, { status: 500 }); }
}
