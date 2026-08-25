import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requirePermission } from "@/lib/auth";

export async function GET() { try { const user = await requirePermission("notifications.view"); const data = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 }); return NextResponse.json({ data, unreadCount: data.filter((item) => !item.readAt).length }); } catch { return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); } }
export async function PATCH(request: Request) { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); const body = await request.json().catch(() => ({})); const where = body.all ? { userId: user.id, readAt: null } : { id: String(body.id ?? ""), userId: user.id, readAt: null }; await prisma.notification.updateMany({ where, data: { readAt: new Date() } }); return NextResponse.json({ ok: true }); }
