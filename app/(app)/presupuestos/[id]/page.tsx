"use client";

import { useState } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Building2, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { QuoteStatusBadge, TipoFacturacionBadge, WorkOrderStatusBadge } from "@/components/shared/status-badges";
import { formatARS, formatDate, formatM2 } from "@/lib/format";
import { getQuote, getClient, getWorkOrder } from "@/lib/mock-data";

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  const quote = getQuote(params.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [generated, setGenerated] = useState(false);
  const router = useRouter();

  if (!quote) return notFound();
  const client = getClient(quote.clienteId);
  const existingOt = quote.workOrderId ? getWorkOrder(quote.workOrderId) : undefined;

  return (
    <div className="space-y-6">
      <Link href="/presupuestos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a presupuestos
      </Link>

      {/* Traceability chain */}
      <Card className="p-4 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max text-xs font-medium">
          <TraceNode label="Cliente" active href={`/clientes/${client?.id}`} />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <TraceNode label={`Presupuesto ${quote.numero}`} active current />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <TraceNode label={existingOt ? existingOt.numero : "OT"} active={!!existingOt} href={existingOt ? `/produccion?ot=${existingOt.id}` : undefined} />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <TraceNode label="Corte" active={!!existingOt} />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {quote.tipo === "DVH" && (
            <>
              <TraceNode label="Armado" active={!!existingOt} />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </>
          )}
          <TraceNode label="Entrega" active={!!existingOt && existingOt.cantidadEntregada > 0} href="/entregas" />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <TraceNode label="Remito" href="/remitos" />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <TraceNode label="Factura" href="/facturacion" />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <TraceNode label="Cobro" href="/cobros" />
        </div>
      </Card>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-vase-green-soft text-vase-green-dark">
            {quote.tipo === "DVH" ? <Layers className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{quote.numero}</h1>
            <p className="text-sm text-muted-foreground">{client?.razonSocial} · {quote.obra}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TipoFacturacionBadge tipo={quote.tipoFacturacion} />
          <QuoteStatusBadge status={quote.estado} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Detalle del presupuesto</p>
          <dl className="grid grid-cols-2 gap-y-3 text-sm sm:grid-cols-3">
            <Field label="Fecha" value={formatDate(quote.fecha)} />
            <Field label="Fecha de entrega" value={formatDate(quote.fechaEntrega)} />
            <Field label="Tipo" value={quote.tipo} />
            <Field label="Cantidad" value={String(quote.cantidadTotal)} />
            <Field label="m² total" value={formatM2(quote.m2Total)} />
            <Field label="CUIT cliente" value={client?.cuit ?? "—"} />
          </dl>
          {quote.observaciones && (
            <p className="mt-4 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">{quote.observaciones}</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Totales</p>
          <div className="space-y-2 text-sm">
            <TotalRow label="Subtotal bruto" value={quote.subtotalBruto} />
            <TotalRow label="Bonificación" value={-quote.montoBonificacion} negative />
            <TotalRow label="Subtotal neto" value={quote.subtotalNeto} bold />
            <TotalRow label="IVA (21%)" value={quote.iva} />
            <div className="border-t border-border pt-2">
              <TotalRow label="Total" value={quote.total} big />
            </div>
          </div>
        </Card>
      </div>

      {existingOt ? (
        <Card className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm font-semibold">Orden de trabajo generada</p>
            <p className="text-xs text-muted-foreground">{existingOt.numero} · avance {existingOt.porcentajeAvance}%</p>
          </div>
          <div className="flex items-center gap-3">
            <WorkOrderStatusBadge status={existingOt.estadoProductivo} />
            <Link href={`/produccion?ot=${existingOt.id}`}>
              <Button variant="outline" size="sm">Ver en producción</Button>
            </Link>
          </div>
        </Card>
      ) : quote.estado === "APROBADO" ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5 border-vase-green/30 bg-vase-green-soft/30">
          <div>
            <p className="text-sm font-semibold">Presupuesto aprobado</p>
            <p className="text-xs text-muted-foreground">Podés generar la orden de trabajo correspondiente.</p>
          </div>
          <Button onClick={() => setConfirmOpen(true)}>Generar orden de trabajo</Button>
        </Card>
      ) : (
        <Card className="p-5 text-sm text-muted-foreground">
          Solo un presupuesto <b className="text-foreground">APROBADO</b> puede generar una Orden de Trabajo.
        </Card>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Generar orden de trabajo"
        description={`Se creará una OT ${quote.tipo === "DVH" ? "general con OT de corte y OT de armado asociadas" : "con su orden de corte asociada"}, referenciando ${quote.numero}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                setGenerated(true);
                setConfirmOpen(false);
              }}
            >
              Confirmar y generar
            </Button>
          </>
        }
      >
        {generated ? (
          <div className="flex items-center gap-2 text-sm text-vase-green">
            <CheckCircle2 className="h-4 w-4" /> OT generada correctamente (demo).
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta acción no duplica información: la OT conserva la referencia al presupuesto original y hereda cliente, obra e ítems.
          </p>
        )}
      </Modal>
    </div>
  );
}

function TraceNode({ label, active, current, href }: { label: string; active?: boolean; current?: boolean; href?: string }) {
  const content = (
    <motion.div
      whileHover={href ? { scale: 1.03 } : undefined}
      className={`rounded-full border px-3 py-1.5 shrink-0 ${
        current
          ? "border-vase-green bg-vase-green text-white"
          : active
          ? "border-vase-green/40 bg-vase-green-soft text-vase-green-dark"
          : "border-border bg-secondary/40 text-muted-foreground"
      }`}
    >
      {label}
    </motion.div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function TotalRow({ label, value, bold, big, negative }: { label: string; value: number; bold?: boolean; big?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""} ${big ? "text-lg font-bold" : ""} ${negative ? "text-red-500" : ""}`}>
        {formatARS(value)}
      </span>
    </div>
  );
}
