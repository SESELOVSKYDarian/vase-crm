import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  try {
    const id = (await params).id;
    const before = await prisma.quote.findUnique({ where: { id } });
    if (!before || before.estado !== "BORRADOR") return NextResponse.json({ error: "Sólo se pueden enviar borradores" }, { status: 400 });
    const quote = await prisma.quote.update({ where: { id }, data: { estado: "ENVIADO" } });
    await writeAudit(user.id, "ENVIAR", "Quote", id, { estado: before.estado }, { estado: quote.estado });
    return NextResponse.json({ data: quote });
  } catch { return NextResponse.json({ error: "No se pudo enviar el presupuesto" }, { status: 500 }); }
}
