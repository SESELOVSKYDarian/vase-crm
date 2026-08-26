"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { formatARS, formatM2 } from "@/lib/format";
import { chartNumber } from "@/lib/analytics-series";

type SeriesRow = { label: string; presupuestado: number; facturado: number; cobrado: number };
type BarRow = { label: string; value: number; color?: string };
type ValueFormat = "number" | "money" | "m2";

const COLORS = ["#16a34a", "#0f766e", "#2563eb", "#d97706", "#7c3aed", "#db2777"];
const SERIES = [
  { key: "presupuestado", label: "Presupuestado", color: "#16a34a" },
  { key: "facturado", label: "Facturado", color: "#0f766e" },
  { key: "cobrado", label: "Cobrado", color: "#2563eb" },
] as const;
const axis = { fontSize: 12, fill: "currentColor", className: "text-muted-foreground" };

function useChartAnimation() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(!window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return enabled;
}

function compact(value: number) {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatValue(value: number, format: ValueFormat) {
  if (format === "money") return formatARS(value);
  if (format === "m2") return formatM2(value);
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

export function RevenueChart({ data }: { data: SeriesRow[] }) {
  const animate = useChartAnimation();
  const rows = useMemo(() => data.map((row) => ({ label: String(row.label), presupuestado: chartNumber(row.presupuestado), facturado: chartNumber(row.facturado), cobrado: chartNumber(row.cobrado) })), [data]);
  const hasMovement = rows.some((row) => SERIES.some((serie) => row[serie.key] > 0));
  if (!rows.length || !hasMovement) return <EmptyChart icon={TrendingUp} title="Sin movimientos en el período" description="Cuando haya presupuestos, facturas o cobros aparecerá su evolución mensual." />;

  return (
    <ChartFrame label="Evolución mensual presupuestada, facturada y cobrada" count={rows.length}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 16, left: 2, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="currentColor" className="text-border/70" strokeDasharray="3 5" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} dy={8} />
          <YAxis tick={axis} tickFormatter={compact} tickLine={false} axisLine={false} width={54} />
          <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.12 }} />
          <Legend content={<ChartLegend />} verticalAlign="top" align="right" height={38} />
          {SERIES.map((serie) => <Line key={serie.key} type="monotone" dataKey={serie.key} name={serie.label} stroke={serie.color} strokeWidth={2.5} dot={{ r: 3, fill: serie.color, strokeWidth: 2, stroke: "var(--background)" }} activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--background)" }} isAnimationActive={animate} animationDuration={260} animationEasing="ease-out" />)}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function VerticalBarChart({ data, format = "number" }: { data: BarRow[]; format?: ValueFormat }) {
  const animate = useChartAnimation();
  const rows = useMemo(() => data.map((row, index) => ({ ...row, value: chartNumber(row.value), color: row.color ?? COLORS[index % COLORS.length] })), [data]);
  if (!rows.length || rows.every((row) => row.value === 0)) return <EmptyChart />;
  return (
    <ChartFrame label="Gráfico de barras vertical" count={rows.length}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 12, left: 0, bottom: 6 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="currentColor" className="text-border/70" strokeDasharray="3 5" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} dy={8} interval={0} />
          <YAxis tick={axis} tickFormatter={(value) => format === "m2" ? `${compact(value)} m²` : compact(value)} tickLine={false} axisLine={false} width={62} allowDecimals={format !== "number"} />
          <Tooltip content={<ValueTooltip format={format} />} cursor={{ fill: "currentColor", fillOpacity: 0.035 }} />
          <Bar dataKey="value" name="Valor" radius={[8, 8, 3, 3]} maxBarSize={92} isAnimationActive={animate} animationDuration={240} animationEasing="ease-out">
            {rows.map((row) => <Cell key={row.label} fill={row.color} />)}
            <LabelList dataKey="value" position="top" formatter={(value: number) => format === "m2" ? formatM2(value) : compact(value)} className="fill-foreground text-[11px] font-semibold" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function HorizontalBarChart({ data, format = "money" }: { data: BarRow[]; format?: "money" | "number" }) {
  const animate = useChartAnimation();
  const rows = useMemo(() => data.map((row, index) => ({ ...row, value: chartNumber(row.value), color: row.color ?? COLORS[index % COLORS.length] })), [data]);
  if (!rows.length || rows.every((row) => row.value === 0)) return <EmptyChart />;
  return (
    <ChartFrame label="Cobros agrupados por medio de pago" count={rows.length}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={rows} margin={{ top: 8, right: 48, left: 12, bottom: 8 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke="currentColor" className="text-border/70" strokeDasharray="3 5" />
          <XAxis type="number" tick={axis} tickFormatter={compact} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={112} />
          <Tooltip content={<ValueTooltip format={format} />} cursor={{ fill: "currentColor", fillOpacity: 0.035 }} />
          <Bar dataKey="value" name="Cobrado" radius={[3, 8, 8, 3]} maxBarSize={38} isAnimationActive={animate} animationDuration={240} animationEasing="ease-out">
            {rows.map((row) => <Cell key={row.label} fill={row.color} />)}
            <LabelList dataKey="value" position="right" formatter={(value: number) => format === "money" ? compact(value) : value} className="fill-foreground text-[11px] font-semibold" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function ChartFrame({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return <div className="chart-enter h-full min-h-0 w-full" role="img" aria-label={label}>{children}<span className="sr-only">El gráfico contiene {count} registros.</span></div>;
}

function ChartLegend({ payload }: any) {
  return <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">{(payload ?? []).map((entry: any) => <span key={entry.value} className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />{entry.value}</span>)}</div>;
}

function RevenueTooltip({ active, label, payload }: any) {
  if (!active || !payload?.length) return null;
  return <TooltipSurface title={label}>{payload.map((entry: any) => <TooltipRow key={entry.dataKey} label={entry.name} value={formatARS(Number(entry.value))} color={entry.color} />)}</TooltipSurface>;
}

function ValueTooltip({ active, label, payload, format = "number" }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return <TooltipSurface title={label}><TooltipRow label={entry.name ?? "Valor"} value={formatValue(Number(entry.value), format)} color={entry.payload?.color ?? entry.color} /></TooltipSurface>;
}

function TooltipSurface({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="min-w-44 rounded-xl border border-border/80 bg-card/95 px-3.5 py-3 text-xs shadow-[0_14px_32px_-18px_rgba(15,23,42,.45)] backdrop-blur-md"><p className="mb-2 font-semibold capitalize text-foreground">{title}</p><div className="space-y-1.5">{children}</div></div>;
}

function TooltipRow({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="flex items-center justify-between gap-5 text-muted-foreground"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span><strong className="font-semibold tabular-nums text-foreground">{value}</strong></div>;
}

function EmptyChart({ icon: Icon = BarChart3, title = "Sin datos para graficar", description = "Probá ampliando el período o cambiando los filtros." }: { icon?: typeof BarChart3; title?: string; description?: string }) {
  return <div className="chart-enter flex h-full min-h-[220px] items-center justify-center px-6 text-center"><div className="max-w-xs"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-vase-green-soft text-vase-green"><Icon className="h-5 w-5" aria-hidden="true" /></span><p className="mt-3 text-sm font-semibold text-foreground">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>;
}
