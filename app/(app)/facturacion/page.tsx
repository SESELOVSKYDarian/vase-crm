"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TipoFacturacionBadge } from "@/components/shared/status-badges";
import { invoices, getClient } from "@/lib/mock-data";
import { formatARS, formatDate } from "@/lib/format";
import { ShieldCheck, ShieldAlert, FileWarning } from "lucide-react";
import type { TipoFacturacion } from "@/types";

export default function FacturacionPage() {
  const [filtro, setFiltro] = useState<TipoFacturacion | "TODOS">("TODOS");

  const filtered = invoices.filter((f) => filtro === "TODOS" || f.tipoFacturacion === filtro);
  const totalA = invoices.filter((f) => f.tipoFacturacion === "A").reduce((a, f) => a + f.total, 0);
  const totalN = invoices.filter((f) => f.tipoFacturacion === "N").reduce((a, f) => a + f.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Facturación</h1>
        <p className="text-sm text-muted-foreground">Comprobantes fiscales (tipo A vía ARCA) y registros internos (tipo N)</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Facturado tipo A (fiscal)</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatARS(totalA)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Registrado tipo N (interno)</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatARS(totalN)}</p>
        </Card>
        <Card className="p-4 border-vase-green/30 bg-vase-green-soft/30">
          <p className="text-xs text-muted-foreground">Total (A + N)</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatARS(totalA + totalN)}</p>
        </Card>
      </div>

      <Tabs
        value={filtro}
        onChange={(v) => setFiltro(v as any)}
        tabs={[
          { value: "TODOS", label: "Todos" },
          { value: "A", label: "Tipo A · Fiscal" },
          { value: "N", label: "Tipo N · Interno" },
        ]}
      />

      <div className="space-y-3">
        {filtered.map((f, i) => {
          const client = getClient(f.clienteId);
          return (
            <motion.div key={f.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{f.numero}</p>
                      <TipoFacturacionBadge tipo={f.tipoFacturacion} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{client?.razonSocial} · {formatDate(f.fecha)}</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{formatARS(f.total)}</p>
                </div>

                {f.tipoFacturacion === "A" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-4 rounded-md bg-secondary/50 px-3 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {f.estadoArca === "AUTORIZADA" ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-vase-green" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      ARCA: {f.estadoArca}
                    </span>
                    {f.cae && <span className="text-muted-foreground">CAE {f.cae}</span>}
                    {f.vencimientoCae && <span className="text-muted-foreground">vence {formatDate(f.vencimientoCae)}</span>}
                    <span className="text-muted-foreground">PV {String(f.puntoVenta).padStart(4, "0")}</span>
                    <Badge variant={f.estadoPago === "PAGADA" ? "success" : f.estadoPago === "PARCIAL" ? "warning" : "neutral"} className="ml-auto">
                      {f.estadoPago === "PAGADA" ? "Pagada" : f.estadoPago === "PARCIAL" ? `Parcial · ${formatARS(f.montoCobrado)} cobrado` : "Pendiente de cobro"}
                    </Badge>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-4 rounded-md bg-secondary/50 px-3 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                      <FileWarning className="h-3.5 w-3.5" /> Registro interno — no es comprobante fiscal, no pasa por ARCA
                    </span>
                    <Badge variant={f.estadoPago === "PAGADA" ? "success" : "neutral"} className="ml-auto">
                      {f.estadoPago === "PAGADA" ? "Pagada" : "Pendiente de cobro"}
                    </Badge>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
