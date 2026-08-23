import { prisma } from "@/lib/prisma";

export async function writeAudit(userId: string | undefined, accion: string, entidad: string, entidadId: string, valorAnterior?: unknown, valorNuevo?: unknown) {
  await prisma.auditLog.create({ data: { userId, accion, entidad, entidadId, valorAnterior: valorAnterior as any, valorNuevo: valorNuevo as any } });
}
