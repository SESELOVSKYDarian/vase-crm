"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { formatARS } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

const porCategoria = [
  { categoria: "Simple", A: 1_820_000, N: 158_400 },
  { categoria: "DVH", A: 9_300_000, N: 0 },
  { categoria: "Templado", A: 640_000, N: 0 },
  { categoria: "Pulido", A: 210_000, N: 40_000 },
];

const cobranzaPorMetodo = [
  { metodo: "Transferencia", monto: 1_650_000 },
  { metodo: "Efectivo", monto: 380_000 },
  { metodo: "Dólares", monto: 2_700_000 },
  { metodo: "Cheque físico", monto: 210_000 },
  { metodo: "E-cheq", monto: 95_000 },
];

const productivas = [
  { mes: "May", generadas: 12, terminadas: 10 },
  { mes: "Jun", generadas: 15, terminadas: 13 },
  { mes: "Jul", generadas: 18, terminadas: 14 },
  { mes: "Ago", generadas: 9, terminadas: 4 },
];

export default function AnaliticasPage() {
  const [filtro, setFiltro] = useState("TODOS");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Analíticas</h1>
          <p className="text-sm text-muted-foreground">Comerciales, de cobranza, financieras y productivas</p>
        </div>
        <Tabs value={filtro} onChange={setFiltro} tabs={[{ value: "TODOS", label: "Todos" }, { value: "A", label: "Tipo A" }, { value: "N", label: "Tipo N" }]} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Presupuestado por categoría (A vs. N)</CardTitle>
            <CardDescription>ARS del mes en curso</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCategoria} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="categoria" fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => formatARS(v)} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="A" name="Tipo A" fill="#16A34A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="N" name="Tipo N" fill="#09090B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cobranza por método de pago</CardTitle>
            <CardDescription>ARS equivalentes, mes en curso</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cobranzaPorMetodo} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="metodo" fontSize={12} width={110} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => formatARS(v)} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="monto" fill="#16A34A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>OT generadas vs. terminadas</CardTitle>
            <CardDescription>Últimos 4 meses</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivas} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="generadas" name="Generadas" fill="#86EFAC" radius={[4, 4, 0, 0]} />
                <Bar dataKey="terminadas" name="Terminadas" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
