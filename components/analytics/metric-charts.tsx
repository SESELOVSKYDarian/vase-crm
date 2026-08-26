"use client";

import { useMemo, useState } from "react";
import { formatARS, formatM2 } from "@/lib/format";
import { chartNumber } from "@/lib/analytics-series";

type SeriesRow = { label: string; presupuestado: number; facturado: number; cobrado: number };
type BarRow = { label: string; value: number; color?: string };
const palette = ["#16a34a", "#0f766e", "#2563eb", "#ca8a04", "#7c3aed", "#db2777"];
const finite = chartNumber;

export function RevenueChart({ data }: { data: SeriesRow[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const rows = useMemo(() => data.map((row) => ({ label: String(row.label), presupuestado: finite(row.presupuestado), facturado: finite(row.facturado), cobrado: finite(row.cobrado) })), [data]);
  const max = Math.max(1, ...rows.flatMap((row) => [row.presupuestado, row.facturado, row.cobrado]));
  const x = (index: number) => rows.length < 2 ? 50 : 8 + index * 84 / (rows.length - 1);
  const y = (value: number) => 88 - (value / max) * 72;
  const line = (key: keyof Omit<SeriesRow, "label">) => rows.map((row, index) => `${x(index)},${y(row[key])}`).join(" ");
  if (!rows.length) return <EmptyChart />;
  const current = selected === null ? null : rows[selected];
  return <div className="relative h-full min-h-0" role="img" aria-label="Evolución mensual presupuestada, facturada y cobrada"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible"><g stroke="currentColor" className="text-border" strokeWidth=".35">{[16, 40, 64, 88].map((value) => <line key={value} x1="8" x2="94" y1={value} y2={value} vectorEffect="non-scaling-stroke" />)}</g>{([ ["presupuestado", "#16a34a"], ["facturado", "#0f766e"], ["cobrado", "#2563eb"] ] as const).map(([key, color]) => <polyline key={key} points={line(key)} fill="none" stroke={color} strokeWidth=".9" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />)}{rows.map((row, index) => <g key={row.label} onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} tabIndex={0} className="cursor-pointer outline-none"><rect x={x(index) - 4} y="8" width="8" height="80" fill="transparent" />{([ ["presupuestado", "#16a34a"], ["facturado", "#0f766e"], ["cobrado", "#2563eb"] ] as const).map(([key, color]) => <circle key={key} cx={x(index)} cy={y(row[key])} r={selected === index ? "1.55" : "1.05"} fill={color} />)}<text x={x(index)} y="98" textAnchor="middle" className="fill-muted-foreground text-[3px]">{row.label}</text></g>)}</svg><Legend /><TooltipCard label={current?.label} rows={current ? [{ label: "Presupuestado", value: formatARS(current.presupuestado), color: "#16a34a" }, { label: "Facturado", value: formatARS(current.facturado), color: "#0f766e" }, { label: "Cobrado", value: formatARS(current.cobrado), color: "#2563eb" }] : []} /></div>;
}

export function VerticalBarChart({ data, format = "number" }: { data: BarRow[]; format?: "number" | "money" | "m2" }) {
  const [selected, setSelected] = useState<number | null>(null); const rows = useMemo(() => data.map((row) => ({ ...row, value: finite(row.value) })), [data]); const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <EmptyChart />;
  const width = Math.max(12, 76 / rows.length); const value = (number: number) => format === "money" ? formatARS(number) : format === "m2" ? formatM2(number) : String(number);
  const current = selected === null ? null : rows[selected];
  return <div className="relative h-full min-h-0" role="img" aria-label="Gráfico de barras"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible"><g stroke="currentColor" className="text-border" strokeWidth=".35">{[16, 40, 64, 88].map((y) => <line key={y} x1="8" x2="94" y1={y} y2={y} vectorEffect="non-scaling-stroke" />)}</g>{rows.map((row, index) => { const height = Math.max(1, row.value / max * 72); const x = 10 + index * (80 / rows.length) + (80 / rows.length - width) / 2; return <g key={row.label} onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} tabIndex={0} className="cursor-pointer outline-none"><rect x={x} y={88 - height} width={width} height={height} rx="1.8" fill={row.color ?? palette[index % palette.length]} opacity={selected === null || selected === index ? 1 : .55} /><text x={x + width / 2} y="98" textAnchor="middle" className="fill-muted-foreground text-[3px]">{row.label}</text></g>; })}</svg><TooltipCard label={current?.label} rows={current ? [{ label: "Valor", value: value(current.value), color: current.color ?? palette[(selected ?? 0) % palette.length] }] : []} /></div>;
}

export function HorizontalBarChart({ data, format = "money" }: { data: BarRow[]; format?: "money" | "number" }) {
  const [selected, setSelected] = useState<number | null>(null); const rows = useMemo(() => data.map((row) => ({ ...row, value: finite(row.value) })), [data]); const max = Math.max(1, ...rows.map((row) => row.value)); if (!rows.length) return <EmptyChart />;
  const rowHeight = 76 / rows.length; const current = selected === null ? null : rows[selected];
  return <div className="relative h-full min-h-0" role="img" aria-label="Gráfico horizontal"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">{rows.map((row, index) => { const y = 9 + index * rowHeight; const width = row.value / max * 58; return <g key={row.label} onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} tabIndex={0} className="cursor-pointer outline-none"><text x="1" y={y + rowHeight / 2 + 1.5} className="fill-muted-foreground text-[3px]">{row.label}</text><rect x="34" y={y} width={width} height={Math.min(12, rowHeight - 3)} rx="1.8" fill={row.color ?? palette[index % palette.length]} opacity={selected === null || selected === index ? 1 : .55} /></g>; })}</svg><TooltipCard label={current?.label} rows={current ? [{ label: "Cobrado", value: format === "money" ? formatARS(current.value) : String(current.value), color: current.color ?? palette[(selected ?? 0) % palette.length] }] : []} /></div>;
}

function Legend() { return <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#16a34a]" />Presupuestado</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#0f766e]" />Facturado</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#2563eb]" />Cobrado</span></div>; }
function TooltipCard({ label, rows }: { label?: string; rows: { label: string; value: string; color: string }[] }) { if (!label) return null; return <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur"><p className="mb-1 font-semibold">{label}</p>{rows.map((row) => <p key={row.label} className="flex items-center justify-between gap-3 text-muted-foreground"><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: row.color }} />{row.label}</span><b className="text-foreground tabular-nums">{row.value}</b></p>)}</div>; }
function EmptyChart() { return <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl bg-secondary/35 px-6 text-center text-sm text-muted-foreground">Todavía no hay datos suficientes para este gráfico.</div>; }
