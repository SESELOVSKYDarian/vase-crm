import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { try { return NextResponse.json({ data: await prisma.quote.findUnique({ where: { id: (await params).id }, include: { items: true, client: true } }) }); } catch { return NextResponse.json({ error: "No se pudo cargar" }, { status: 404 }); } }
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const id = (await params).id; await prisma.quote.update({ where: { id }, data: { estado: "ANULADO" } }); return NextResponse.json({ data: { ok: true } }); } catch { return NextResponse.json({ error: "No se pudo borrar" }, { status: 400 }); } }
