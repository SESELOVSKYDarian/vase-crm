"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Mail, MapPin, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { QuoteStatusBadge, WorkOrderStatusBadge, InvoiceStatusBadge } from "@/components/shared/status-badges";
import { formatARS, formatDate } from "@/lib/format";
import {
  getClient,
  quotesForClient,
  workOrdersForClient,
  invoicesForClient,
  paymentsForClient,
  accountMovementsForClient,
  balanceForClient,
} from "@/lib/mock-data";

export default function ClienteDetailPage({ params }: { params: { id: string } }) {
  const client = getClient(params.id);
  const [tab, setTab] = useState("presupuestos");

  if (!client) return notFound();

  const quotes = quotesForClient(client.id);
  const orders = workOrdersForClient(client.id);
  const invoices = invoicesForClient(client.id);
  const payments = paymentsForClient(client.id);
  const movements = accountMovementsForClient(client.id);
  const saldo = balanceForClient(client.id);

  return (
    <div className="space-y-6">
      <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a clientes
      </Link>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-vase-green-soft text-vase-green-dark">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">{client.razonSocial}</h1>
                <p className="text-sm text-muted-foreground">{client.codigoCliente} · CUIT {client.cuit}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {client.domicilio}</span>
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {client.telefono}</span>
                  <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {client.email}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Saldo cuenta corriente</p>
              <p className={`text-2xl font-bold tabular-nums ${saldo > 0 ? "text-red-500" : "text-vase-green"}`}>
                {formatARS(saldo)}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MiniStat label="Presupuestos" value={String(quotes.length)} />
        <MiniStat label="OT" value={String(orders.length)} />
        <MiniStat label="Facturas" value={String(invoices.length)} />
        <MiniStat label="Pagos" value={String(payments.length)} />
        <MiniStat label="Total facturado" value={formatARS(invoices.reduce((a, i) => a + i.total, 0))} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "presupuestos", label: "Presupuestos" },
          { value: "ot", label: "OT" },
          { value: "facturas", label: "Facturas" },
          { value: "pagos", label: "Pagos" },
          { value: "cuenta", label: "Cuenta corriente" },
        ]}
      />

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === "presupuestos" && (
          <Card className="divide-y divide-border">
            {quotes.map((q) => (
              <Link key={q.id} href={`/presupuestos/${q.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/40">
                <div>
                  <p className="text-sm font-medium">{q.numero} · {q.obra}</p>
                  <p className="text-xs text-muted-foreground">{q.tipo} · {formatDate(q.fecha)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">{formatARS(q.total)}</span>
                  <QuoteStatusBadge status={q.estado} />
                </div>
              </Link>
            ))}
            {quotes.length === 0 && <p className="p-6 text-sm text-muted-foreground">Sin presupuestos.</p>}
          </Card>
        )}

        {tab === "ot" && (
          <Card className="divide-y divide-border">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{o.numero} · {o.obra}</p>
                  <p className="text-xs text-muted-foreground">Avance {o.porcentajeAvance}% · Entrega {formatDate(o.fechaEntrega)}</p>
                </div>
                <WorkOrderStatusBadge status={o.estadoProductivo} />
              </div>
            ))}
            {orders.length === 0 && <p className="p-6 text-sm text-muted-foreground">Sin órdenes de trabajo.</p>}
          </Card>
        )}

        {tab === "facturas" && (
          <Card className="divide-y divide-border">
            {invoices.map((f) => (
              <div key={f.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{f.numero} <Badge variant={f.tipoFacturacion === "A" ? "success" : "outline"} className="ml-1">{f.tipoFacturacion}</Badge></p>
                  <p className="text-xs text-muted-foreground">{formatDate(f.fecha)} {f.cae && `· CAE ${f.cae}`}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatARS(f.total)}</span>
              </div>
            ))}
            {invoices.length === 0 && <p className="p-6 text-sm text-muted-foreground">Sin facturas.</p>}
          </Card>
        )}

        {tab === "pagos" && (
          <Card className="divide-y divide-border">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{p.numero} · {p.metodo.replace("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.fecha)}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-vase-green">{formatARS(p.moneda === "USD" ? (p.montoEquivalenteArs ?? 0) : p.importe)}</span>
              </div>
            ))}
            {payments.length === 0 && <p className="p-6 text-sm text-muted-foreground">Sin pagos registrados.</p>}
          </Card>
        )}

        {tab === "cuenta" && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Referencia</th>
                  <th className="px-4 py-2.5 text-right">Debe</th>
                  <th className="px-4 py-2.5 text-right">Haber</th>
                  <th className="px-4 py-2.5 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(m.fecha)}</td>
                    <td className="px-4 py-2.5">{m.tipo}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.referencia}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.debe ? formatARS(m.debe) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-vase-green">{m.haber ? formatARS(m.haber) : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatARS(m.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 && <p className="p-6 text-sm text-muted-foreground">Sin movimientos.</p>}
          </Card>
        )}
      </motion.div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums truncate">{value}</p>
    </Card>
  );
}
