import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

function allowed(user: any, key: string) { return hasPermission(user, key); }

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const audit = await prisma.auditLog.findUnique({ where: { id: (await params).id } });
  if (!audit || !["Invoice", "Payment"].includes(audit.entidad)) return NextResponse.json({ error: "Versión no restaurable" }, { status: 404 });
  const permission = audit.entidad === "Invoice" ? "invoices.edit" : "payments.edit";
  if (!allowed(user, permission)) return NextResponse.json({ error: "No tenés permiso para restaurar esta versión" }, { status: 403 });
  const previous = audit.valorAnterior as any;
  try {
    if (audit.accion === "EDITAR" && previous) {
      if (audit.entidad === "Invoice") await prisma.invoice.update({ where: { id: audit.entidadId }, data: { cuit: previous.cuit, puntoVenta: previous.puntoVenta } });
      else await prisma.payment.update({ where: { id: audit.entidadId }, data: { recibo: previous.recibo, observaciones: previous.observaciones } });
    } else if (audit.accion === "BORRAR" && previous?.record) {
      if (audit.entidad === "Invoice") {
        const record = previous.record;
        await prisma.$transaction(async (tx) => {
          await tx.invoice.create({ data: { ...record, fecha: new Date(record.fecha), vencimientoCae: record.vencimientoCae ? new Date(record.vencimientoCae) : null, items: { create: previous.items ?? [] } } });
          const balances = await tx.accountMovement.aggregate({ where: { clientId: record.clientId }, _sum: { debe: true, haber: true } });
          await tx.accountMovement.create({ data: { clientId: record.clientId, tipo: "FACTURA", referencia: record.numero, debe: record.total, haber: 0, saldo: Number(balances._sum.debe ?? 0) - Number(balances._sum.haber ?? 0) + Number(record.total) } });
          await tx.workOrder.update({ where: { id: record.workOrderId }, data: { estadoFacturacion: "FACTURADA" } });
        });
      } else {
        const record = previous.record;
        await prisma.$transaction(async (tx) => {
          await tx.payment.create({ data: { ...record, fecha: new Date(record.fecha), fechaTipoCambio: record.fechaTipoCambio ? new Date(record.fechaTipoCambio) : null, allocations: { create: previous.allocations ?? [] } } });
          const balances = await tx.accountMovement.aggregate({ where: { clientId: record.clientId }, _sum: { debe: true, haber: true } });
          await tx.accountMovement.create({ data: { clientId: record.clientId, tipo: "PAGO", referencia: record.numero, debe: 0, haber: record.montoEquivalenteArs ?? record.importe, saldo: Number(balances._sum.debe ?? 0) - Number(balances._sum.haber ?? 0) - Number(record.montoEquivalenteArs ?? record.importe) } });
        });
      }
    } else return NextResponse.json({ error: "Esta versión antigua no contiene datos suficientes para restaurarse" }, { status: 409 });
    await writeAudit(user.id, "RESTAURAR", audit.entidad, audit.entidadId, undefined, { auditId: audit.id, accionOriginal: audit.accion });
    return NextResponse.json({ data: { restored: true } });
  } catch (error) {
    console.error("[audit restore]", error);
    return NextResponse.json({ error: "No se pudo restaurar la versión. Verificá que el registro no haya sido recreado." }, { status: 409 });
  }
}
