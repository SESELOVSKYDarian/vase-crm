import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArcaProvider } from "@/modules/arca/server";

const isInfrastructure = (message: string) => /timeout|conectar|network|fetch|http 5|dns|reset|unavailable/i.test(message);
const notify = async (type: string, title: string, message: string, environment: string) => {
  const users = await prisma.user.findMany({ where: { active: true, userRoles: { some: { role: { name: { in: ["ADMIN", "ATENCION_CLIENTE"] }, active: true } } } }, select: { id: true } });
  await prisma.notification.createMany({ data: users.map((user) => ({ userId: user.id, type, title, message, entityType: "ARCA", entityId: environment, priority: "HIGH", deduplicationKey: `${type}:${environment}:${user.id}` })), skipDuplicates: true });
};

export async function POST(request: Request) {
  if (process.env.ARCA_MONITOR_ENABLED !== "true") return NextResponse.json({ data: { skipped: "disabled" } });
  if (!process.env.INTERNAL_JOBS_SECRET || request.headers.get("x-vase-job-secret") !== process.env.INTERNAL_JOBS_SECRET) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const started = Date.now(); let environment = "HOMOLOGACION"; let status = "OPERATIVO"; let wsaaStatus = "OPERATIVO"; let wsfeStatus = "OPERATIVO"; let category: string | undefined; let message: string | undefined;
  try { const { provider, settings } = await getArcaProvider(); environment = settings.arcaEnvironment; await provider.testAuthentication(); await provider.getParameters(); }
  catch (error) { message = error instanceof Error ? error.message.replace(/token|sign|private key|certificate/gi, "[redactado]").slice(0, 500) : "Error de verificación"; category = isInfrastructure(message) ? "INFRASTRUCTURE" : "CONFIGURATION"; status = category === "INFRASTRUCTURE" ? "DEGRADADO" : "CONFIGURACION_INVALIDA"; wsaaStatus = "ERROR"; wsfeStatus = "NO_VERIFICADO"; }
  const check = await prisma.arcaHealthCheck.create({ data: { environment, status, wsaaStatus, wsfeStatus, durationMs: Date.now() - started, errorCategory: category, sanitizedMessage: message } });
  const failures = await prisma.arcaHealthCheck.count({ where: { environment, errorCategory: "INFRASTRUCTURE", checkedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }); const failureThreshold = Number(process.env.ARCA_MONITOR_FAILURE_THRESHOLD ?? 3); const recoveryThreshold = Number(process.env.ARCA_MONITOR_RECOVERY_THRESHOLD ?? 2);
  const incident = await prisma.arcaIncident.findFirst({ where: { environment, status: "OPEN" }, orderBy: { startedAt: "desc" } });
  if (category === "INFRASTRUCTURE" && failures >= failureThreshold) { if (!incident) { await prisma.arcaIncident.create({ data: { environment, service: "WSAA/WSFEv1", failureCount: failures, lastMessage: message } }); await notify("ARCA_POSSIBLE_OUTAGE", "Posible indisponibilidad de ARCA", `ARCA no está respondiendo desde Vase CRM luego de ${failures} verificaciones. Las credenciales locales fueron validadas antes del incidente.`, environment); } else await prisma.arcaIncident.update({ where: { id: incident.id }, data: { failureCount: failures, lastMessage: message } }); status = "POSIBLE_CAIDA_ARCA"; }
  if (!category && incident) { const successes = await prisma.arcaHealthCheck.count({ where: { environment, status: "OPERATIVO", checkedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }); if (successes >= recoveryThreshold) { await prisma.arcaIncident.update({ where: { id: incident.id }, data: { status: "RECOVERED", recoveredAt: new Date() } }); await notify("ARCA_RECOVERED", "Conexión ARCA restablecida", "WSAA y WSFEv1 vuelven a responder correctamente desde Vase CRM.", environment); } }
  await prisma.companySettings.updateMany({ data: { arcaLastConnectionTestAt: check.checkedAt, arcaLastConnectionStatus: status, arcaLastConnectionMessage: message ?? "WSAA y WSFEv1 operativos." } });
  return NextResponse.json({ data: { status, checkId: check.id } });
}
