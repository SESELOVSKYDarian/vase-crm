import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  if (!await getCurrentUser()) return NextResponse.json({ error: "SesiÃ³n requerida" }, { status: 401 });
  const url = new URL(request.url); const entidad = url.searchParams.get("entidad"); const entidadId = url.searchParams.get("entidadId");
  const data = await prisma.auditLog.findMany({ where: { ...(entidad ? { entidad } : {}), ...(entidadId ? { entidadId } : {}) }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ data });
}
