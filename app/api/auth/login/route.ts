import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!user || !user.active || !verifyPassword(String(password), user.passwordHash)) return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo acceder a la base de datos. Verificá DATABASE_URL y las migraciones." }, { status: 503 });
  }
}
