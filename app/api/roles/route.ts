import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
export async function GET() { try { await requirePermission("users.roles.manage"); return NextResponse.json(await prisma.roleDefinition.findMany({ include: { _count: { select: { users: true } }, permissions: { include: { permission: true } } }, orderBy: { name: "asc" } })); } catch { return NextResponse.json({ error: "No autorizado" }, { status: 403 }); } }
export async function POST(request: Request) { try { await requirePermission("users.roles.manage"); const { name, description, permissionIds = [] } = await request.json(); const role = await prisma.roleDefinition.create({ data: { name, description, permissions: { create: permissionIds.map((permissionId: string) => ({ permissionId })) } } }); return NextResponse.json(role, { status: 201 }); } catch { return NextResponse.json({ error: "No se pudo crear el rol" }, { status: 400 }); } }
