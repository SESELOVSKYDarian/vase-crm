import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request); const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
    const input = schema.parse(await request.json()); if (!verifyPassword(input.currentPassword, user.passwordHash)) return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(input.newPassword) } }); await writeAudit(user.id, "USER_PASSWORD_CHANGED", "User", user.id, undefined, { changedByOwner: true });
    return NextResponse.json({ data: { ok: true } });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : "No se pudo actualizar la contraseña." }, { status: 400 }); }
}
