import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const quote = await prisma.quote.update({ where: { id: (await params).id, estado: "BORRADOR" }, data: { estado: "ENVIADO" } }); return NextResponse.json({ data: quote }); } catch { return NextResponse.json({ error: "Sólo se pueden enviar borradores" }, { status: 400 }); } }
