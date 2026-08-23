import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const note = await prisma.deliveryNote.findUnique({ where: { id: (await params).id }, include: { client: true, workOrder: true, items: true } });
  if (!note) return NextResponse.json({ error: "Remito no encontrado" }, { status: 404 });
  return NextResponse.json({ data: note });
}
