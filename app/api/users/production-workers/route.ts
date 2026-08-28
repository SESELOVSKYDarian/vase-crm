import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

type WorkerRole = "CORTADOR" | "ARMADOR";

async function workers(role: WorkerRole) {
  const legacyRole = role === "CORTADOR" ? "CORTE" : "ARMADO";
  const users = await prisma.user.findMany({ where: { active: true, OR: [{ role: legacyRole }, { userRoles: { some: { role: { name: role, active: true } } } }] }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const ids = users.map((user) => user.id);
  const active = !ids.length ? [] : role === "CORTADOR"
    ? await prisma.workOrder.groupBy({ by: ["estadoProductivo", "corteUsuarioId"], where: { corteUsuarioId: { in: ids }, estadoProductivo: { in: ["PENDIENTE", "EN_PROCESO"] } }, _count: { _all: true } })
    : await prisma.workOrder.groupBy({ by: ["estadoProductivo", "armadoUsuarioId"], where: { armadoUsuarioId: { in: ids }, estadoProductivo: { in: ["PENDIENTE", "EN_PROCESO"] } }, _count: { _all: true } });
  return users.map((user) => {
    const count = (status: "PENDIENTE" | "EN_PROCESO") => active.find((entry) => ((entry as any)[role === "CORTADOR" ? "corteUsuarioId" : "armadoUsuarioId"] === user.id) && entry.estadoProductivo === status)?._count._all ?? 0;
    const pendingOrders = count("PENDIENTE"); const inProgressOrders = count("EN_PROCESO");
    return { id: user.id, name: user.name, roles: [role], activeOrders: pendingOrders + inProgressOrders, pendingOrders, inProgressOrders };
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!hasPermission(user, "production.assign")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try { return NextResponse.json({ cortadores: await workers("CORTADOR"), armadores: await workers("ARMADOR") }); }
  catch { return NextResponse.json({ error: "No se pudieron cargar los operarios" }, { status: 500 }); }
}
