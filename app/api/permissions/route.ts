import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
export async function GET() { try { await requirePermission("users.roles.manage"); return NextResponse.json({ data: await prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] }) }); } catch { return NextResponse.json({ error: "No autorizado" }, { status: 403 }); } }
