"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  Receipt,
  Wallet,
  AlertTriangle,
  Factory,
  Layers,
  Truck,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { QuoteStatusBadge, WorkOrderStatusBadge } from "@/components/shared/status-badges";
import { formatARS, formatM2, formatDate } from "@/lib/format";
import { quotes, workOrders, getClient } from "@/lib/mock-data";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Link from "next/link";

const ventasMensuales = [
  { mes: "Mar", presupuestado: 4.2, cobrado: 3.1 },
  { mes: "Abr", presupuestado: 5.1, cobrado: 4.0 },
  { mes: "May", presupuestado: 4.8, cobrado: 4.4 },
  { mes: "Jun", presupuestado: 6.3, cobrado: 5.2 },
  { mes: "Jul", presupuestado: 7.0, cobrado: 6.1 },
  { mes: "Ago", presupuestado: 8.4, cobrado: 5.9 },
];

const categoriaData = [
  { name: "Simple", value: 38, color: "#16A34A" },
  { name: "DVH", value: 44, color: "#22C55E" },
  { name: "Templado", value: 12, color: "#86EFAC" },
  { name: "Otros", value: 6, color: "#D1FAE5" },
];

export default function DashboardPage() {
  const otActivas = workOrders.filter((o) => o.estadoProductivo === "EN_PROCESO" || o.estadoProductivo === "PENDIENTE");
  const otAtrasadas = workOrders.filter(
    (o) => new Date(o.fechaEntrega) < new Date("2026-08-20") && o.estadoProductivo !== "TERMINADA"
  );
  const m2EnProduccion = otActivas.reduce((acc, o) => acc + o.m2Total, 0);
  const m2Entregados = workOrders.reduce((acc, o) => acc + (o.cantidadEntregada / (o.cantidadTotal || 1)) * o.m2Total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen ejecutivo de WTA · agosto 2026</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Presupuestado del mes" value={formatARS(8_400_000)} icon={DollarSign} trend={{ value: "12% vs. jul", positive: true }} accent />
        <StatCard index={1} label="Facturado del mes" value={formatARS(922_014)} icon={Receipt} trend={{ value: "8% vs. jul", positive: true }} />
        <StatCard index={2} label="Cobrado del mes" value={formatARS(565_000)} icon={Wallet} trend={{ value: "3% vs. jul", positive: false }} />
        <StatCard index={3} label="Saldo pendiente" value={formatARS(4_178_968)} icon={AlertTriangle} />
        <StatCard index={4} label="OT activas" value={String(otActivas.length)} icon={Factory} />
        <StatCard index={5} label="OT atrasadas" value={String(otAtrasadas.length)} icon={Clock} />
        <StatCard index={6} label="m² en producción" value={formatM2(m2EnProduccion)} icon={Layers} />
        <StatCard index={7} label="m² entregados" value={formatM2(m2Entregados)} icon={Truck} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Presupuestado vs. cobrado</CardTitle>
            <CardDescription>Últimos 6 meses, en millones de ARS</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ventasMensuales} margin={{ left: -20, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="presupuestado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16A34A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cobrado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#09090B" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#09090B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number) => `$${v}M`}
                />
                <Area type="monotone" dataKey="presupuestado" stroke="#16A34A" strokeWidth={2} fill="url(#presupuestado)" />
                <Area type="monotone" dataKey="cobrado" stroke="#09090B" strokeWidth={2} fill="url(#cobrado)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Presupuestado por categoría</CardTitle>
            <CardDescription>% del mes en curso</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoriaData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {categoriaData.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {categoriaData.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name} · {c.value}%
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Presupuestos recientes</CardTitle>
            <CardDescription>Últimos movimientos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {quotes.slice(0, 5).map((q, i) => {
              const client = getClient(q.clienteId);
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    href={`/presupuestos/${q.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm hover:bg-secondary transition-colors"
                  >
                    <div>
                      <p className="font-medium">{q.numero} · {client?.razonSocial}</p>
                      <p className="text-xs text-muted-foreground">{q.obra} · {formatDate(q.fecha)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">{formatARS(q.total)}</span>
                      <QuoteStatusBadge status={q.estado} />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Producción en curso</CardTitle>
            <CardDescription>Órdenes de trabajo activas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {workOrders.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/produccion?ot=${o.id}`}
                  className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm hover:bg-secondary transition-colors"
                >
                  <div>
                    <p className="font-medium">{o.numero} · {o.obra}</p>
                    <p className="text-xs text-muted-foreground">{o.tipo} · avance {o.porcentajeAvance}%</p>
                  </div>
                  <WorkOrderStatusBadge status={o.estadoProductivo} />
                </Link>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
