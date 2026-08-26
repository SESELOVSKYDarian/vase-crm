import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { getArcaProvider } from "@/modules/arca/server";
import { assertSameOrigin } from "@/lib/security/csrf";
const schema = z.object({
  workOrderId: z.string().min(1),
  tipoFacturacion: z.enum(["A", "N"]),
  puntoVenta: z.coerce.number().int().positive().optional(),
});
function canInvoice(
  u: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
) {
  return hasPermission(u, "invoices.create");
}
export async function GET() {
  const u = await getCurrentUser();
  if (!u)
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!hasPermission(u, "invoices.view")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const rows = await prisma.invoice.findMany({
      include: {
        client: true,
        workOrder: true,
        items: true,
        allocations: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      data: rows.map((i) => {
        const pagado = i.allocations.reduce((s, a) => s + Number(a.monto), 0);
        return {
          ...i,
          importePagado: pagado,
          saldoPendiente: Math.max(0, Number(i.total) - pagado),
        };
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron cargar las facturas" },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origen de solicitud inválido." }, { status: 403 }); }
  const u = await getCurrentUser();
  if (!u)
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!canInvoice(u))
    return NextResponse.json(
      { error: "No tenés permiso para facturar" },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Datos de factura inválidos" },
      { status: 400 },
    );
  try {
    const o = await prisma.workOrder.findUnique({
      where: { id: parsed.data.workOrderId },
      include: {
        quote: { include: { items: true } },
        client: true,
        deliveries: true,
        invoices: true,
      },
    });
    if (!o)
      return NextResponse.json({ error: "OT inexistente" }, { status: 404 });
    if (!o.deliveries.length)
      return NextResponse.json(
        { error: "Primero confirmá un remito para esta OT" },
        { status: 409 },
      );
    if (o.invoices.length)
      return NextResponse.json(
        { error: "Esta OT ya tiene una factura emitida" },
        { status: 409 },
      );
    const n = await prisma.invoice.count(),
      s = await prisma.companySettings.findFirst(),
      a = parsed.data.tipoFacturacion === "A",
      total = Number(o.quote.total);
    const invoice = await prisma.$transaction(async (tx) => {
      const i = await tx.invoice.create({
        data: {
          numero: `${a ? "FA" : "FN"}-${String(n + 1).padStart(6, "0")}`,
          tipoFacturacion: parsed.data.tipoFacturacion,
          arcaVoucherType: a ? "FACTURA_A" : null,
          clientId: o.clientId,
          workOrderId: o.id,
          cuit: o.client.cuit,
          condicionIva: o.client.condicionIva,
          puntoVenta:
            parsed.data.puntoVenta ??
            s?.arcaPuntoVenta ??
            s?.puntoVentaDefault ??
            1,
          subtotal: o.quote.subtotalNeto,
          iva: o.quote.iva,
          total: o.quote.total,
          estadoArca: a ? "PENDIENTE" : "NO_APLICA",
          items: {
            create: o.quote.items.map((x) => ({
              descripcion: x.productoNombre,
              cantidad: x.cantidad,
              precioUnitario: x.precioM2Snapshot,
              subtotal: x.subtotalNeto,
            })),
          },
        },
      });
      if (a)
        await tx.arcaTransaction.create({
          data: {
            invoiceId: i.id,
            idempotencyKey: `arca-${i.id}`,
            environment: s?.arcaEnvironment ?? "HOMOLOGACION",
            requestPayload: {
              reason: "Pendiente de credenciales de homologación",
            },
            resultado: "PENDIENTE",
          },
        });
      const b = await tx.accountMovement.aggregate({
        where: { clientId: o.clientId },
        _sum: { debe: true, haber: true },
      });
      await tx.accountMovement.create({
        data: {
          clientId: o.clientId,
          tipo: "FACTURA",
          referencia: i.numero,
          debe: total,
          haber: 0,
          saldo: Number(b._sum.debe ?? 0) - Number(b._sum.haber ?? 0) + total,
        },
      });
      await tx.workOrder.update({
        where: { id: o.id },
        data: { estadoFacturacion: "FACTURADA" },
      });
      return i;
    });
    if (a) {
      try {
        const { provider } = await getArcaProvider();
        const result = await provider.authorizeInvoice({
          idempotencyKey: `arca-${invoice.id}`,
          environment: provider.getEnvironment(),
          puntoVenta: invoice.puntoVenta,
          voucherType: "FACTURA_A",
          cuitEmisor: s?.arcaCuit ?? "",
          clienteDocTipo: "CUIT",
          clienteDocNumero: invoice.cuit.replace(/\D/g, ""),
          condicionIvaReceptor: invoice.condicionIva,
          fecha: invoice.fecha.toISOString().slice(0, 10),
          importeNeto: Number(invoice.subtotal),
          importeIva: Number(invoice.iva),
          importeTributos: Number(invoice.tributos),
          importeTotal: Number(invoice.total),
          moneda: "PES",
          cotizacionMoneda: 1,
          conceptos: "PRODUCTOS",
        });
        await prisma.$transaction([
          prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              estadoArca: result.estado,
              cae: result.cae,
              vencimientoCae: result.vencimientoCae
                ? new Date(`${result.vencimientoCae}T00:00:00-03:00`)
                : null,
            },
          }),
          prisma.arcaTransaction.update({
            where: { idempotencyKey: `arca-${invoice.id}` },
            data: {
              resultado: result.estado,
              requestPayload: result.requestRaw as any,
              responsePayload: result.responseRaw as any,
              errores: {
                errores: result.errores,
                observaciones: result.observaciones,
              },
            },
          }),
        ]);
      } catch (arcaError) {
        const message =
          arcaError instanceof Error
            ? arcaError.message
            : "No se pudo contactar ARCA.";
        await prisma.$transaction([
          prisma.invoice.update({
            where: { id: invoice.id },
            data: { estadoArca: "ERROR" },
          }),
          prisma.arcaTransaction.update({
            where: { idempotencyKey: `arca-${invoice.id}` },
            data: { resultado: "ERROR", errores: { message } },
          }),
        ]);
      }
    }
    await writeAudit(u.id, "EMITIR", "Invoice", invoice.id, undefined, {
      numero: invoice.numero,
    });
    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (e) {
    console.error("[invoices]", e);
    return NextResponse.json(
      { error: "No se pudo emitir la factura" },
      { status: 500 },
    );
  }
}
