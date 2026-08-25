import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
const navigationPermissions = ["clients.view", "quotes.view", "production.view_all", "production.view_assigned", "deliveries.view", "remitos.view", "invoices.view", "payments.view", "account.view", "analytics.view", "prices.view", "company.settings.manage"];
export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ user: null }, { status: 401 }); return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, roles: user.userRoles.map((r) => r.role.name), permissions: navigationPermissions.filter((permission) => hasPermission(user, permission)) } }); }
