import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export const SESSION_COOKIE = "vase-crm-session";
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
export function verifyPassword(password: string, stored: string) { const [salt, hash] = stored.split(":"); if (!salt || !hash) return false; const actual = scryptSync(password, salt, 64); return timingSafeEqual(actual, Buffer.from(hash, "hex")); }
export async function createSession(userId: string) { const token = randomBytes(32).toString("hex"); await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) } }); (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 }); }
export async function getCurrentUser() { const token = (await cookies()).get(SESSION_COOKIE)?.value; if (!token) return null; const session = await prisma.session.findFirst({ where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: { include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } } }); if (!session?.user.active) return null; return session.user; }
export async function revokeSession() { const token = (await cookies()).get(SESSION_COOKIE)?.value; if (token) await prisma.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } }); (await cookies()).delete(SESSION_COOKIE); }
export async function requirePermission(permission: string) { const user = await getCurrentUser(); if (!user) throw new Error("UNAUTHENTICATED"); if (hasPermission(user, permission)) return user; throw new Error("FORBIDDEN"); }
