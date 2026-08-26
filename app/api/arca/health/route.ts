import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET() { const user = await getCurrentUser(); if (!user || !hasPermission(user, "invoices.view")) return NextResponse.json({ error: "No autorizado" }, { status: 403 }); const settings = await prisma.companySettings.findFirst(); const checks = await prisma.arcaHealthCheck.findMany({ where: settings ? { environment: settings.arcaEnvironment } : undefined, orderBy: { checkedAt: "desc" }, take: 20 }); const incident = settings ? await prisma.arcaIncident.findFirst({ where: { environment: settings.arcaEnvironment, status: "OPEN" }, orderBy: { startedAt: "desc" } }) : null; return NextResponse.json({ data: { status: settings?.arcaLastConnectionStatus ?? "SIN_CONFIGURAR", checkedAt: settings?.arcaLastConnectionTestAt, message: settings?.arcaLastConnectionMessage, checks, incident } }); }
