import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = userSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const { name, email, password, role, active } = parsed.data;
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    const user = await prisma.user.create({ data: { name, email, passwordHash, role, active }, select: { id: true, name: true, email: true, role: true, active: true } });
    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
    return NextResponse.json({ error: "No se pudo crear el usuario. Verificá la conexión a la base de datos." }, { status: 500 });
  }
}

export async function GET() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true }, orderBy: { name: "asc" } });
  return NextResponse.json(users);
}

export async function PATCH(request: Request) { try { const body = await request.json(); const data: any = {}; if (body.name) data.name = body.name; if (body.email) data.email = body.email; if (typeof body.active === "boolean") data.active = body.active; if (body.role) data.role = body.role; const user = await prisma.user.update({ where: { id: body.id }, data, select: { id: true, name: true, email: true, role: true, active: true } }); return NextResponse.json(user); } catch { return NextResponse.json({ error: "No se pudo editar el usuario" }, { status: 400 }); } }
export async function DELETE(request: Request) { try { const id = new URL(request.url).searchParams.get("id"); if (!id) throw new Error(); const count = await prisma.user.count({ where: { role: "ADMIN", active: true } }); const target = await prisma.user.findUnique({ where: { id } }); if (target?.role === "ADMIN" && count <= 1) return NextResponse.json({ error: "No podés eliminar al último administrador" }, { status: 409 }); await prisma.user.delete({ where: { id } }); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "No se pudo eliminar el usuario" }, { status: 400 }); } }
