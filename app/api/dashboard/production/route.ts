import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const tasks = [
  { field: "corteUsuarioId", assignedAt: "corteAsignadoAt", label: "Corte" },
  { field: "armadoUsuarioId", assignedAt: "armadoAsignadoAt", label: "Armado" },
  { field: "produccionUsuarioId", assignedAt: "produccionAsignadoAt", label: "Producción" },
] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!hasAnyPermission(user, ["production.view_assigned", "production.view_all"])) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (hasPermission(user, "production.view_all")) return NextResponse.json({ error: "Este panel es exclusivo para operarios asignados." }, { status: 403 });

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const where = { OR: tasks.map((task) => ({ [task.field]: user.id })) };
  const orders = await prisma.workOrder.findMany({
    where,
    include: { client: { select: { razonSocial: true } }, items: { select: { cantidad: true } }, progressEntries: { select: { task: true, quantity: true } } },
    orderBy: [{ fechaEntrega: "asc" }, { createdAt: "desc" }],
  });
  const assignedTasks = (order: (typeof orders)[number]) => tasks.filter((task) => order[task.field] === user.id);
  const taskLabel = (order: (typeof orders)[number]) => assignedTasks(order).map((task) => task.label).join(" · ");
  const progress = (order: (typeof orders)[number]) => order.progressEntries
    .filter((entry) => assignedTasks(order).some((task) => task.label.toUpperCase().replace("Ó", "O") === entry.task))
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const assignedThisWeek = orders.filter((order) => assignedTasks(order).some((task) => {
    const assignedAt = order[task.assignedAt];
    return assignedAt && assignedAt >= weekStart;
  }));
  const card = (order: (typeof orders)[number]) => ({
    id: order.id, numero: order.numero, client: order.client.razonSocial, sector: taskLabel(order), fechaEntrega: order.fechaEntrega,
    estado: order.estadoProductivo, total: order.items.reduce((sum, item) => sum + item.cantidad, 0), completed: progress(order),
    assignedAt: assignedTasks(order).map((task) => order[task.assignedAt]).filter(Boolean).sort().at(-1) ?? null,
  });
  const active = orders.filter((order) => !["TERMINADA", "ANULADA"].includes(order.estadoProductivo));
  const priority = [...active].sort((a, b) => a.fechaEntrega.getTime() - b.fechaEntrega.getTime()).slice(0, 8).map(card);
  return NextResponse.json({ data: {
    summary: {
      pending: orders.filter((order) => order.estadoProductivo === "PENDIENTE").length,
      overdue: active.filter((order) => order.fechaEntrega < now).length,
      completed: orders.filter((order) => order.estadoProductivo === "TERMINADA").length,
      newThisWeek: assignedThisWeek.length,
    },
    upcoming: priority,
    newAssignments: assignedThisWeek.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 8).map(card),
  } });
}
