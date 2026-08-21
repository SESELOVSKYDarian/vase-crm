import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
const schema = z.object({ nombre: z.string().trim().min(2), descripcion: z.string().optional() });
export async function GET() { try { return NextResponse.json({ data: await prisma.productCategoryDefinition.findMany({ include: { _count: { select: { products: true } } }, orderBy: { nombre: "asc" } }) }); } catch { return NextResponse.json({ error: "No se pudieron cargar las categorías" }, { status: 500 }); } }
export async function POST(request: Request) { const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 }); try { return NextResponse.json({ data: await prisma.productCategoryDefinition.create({ data: parsed.data }) }, { status: 201 }); } catch { return NextResponse.json({ error: "La categoría ya existe" }, { status: 409 }); } }
