"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { payments, getClient } from "@/lib/mock-data";
import { formatARS, formatDate } from "@/lib/format";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";

const methodLabels: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CHEQUE_FISICO: "Cheque físico",
  ECHEQ: "E-cheq",
  CHEQUE_TERCEROS: "Cheque de terceros",
  DOLARES: "Dólares",
  OTRO: "Otro",
};

export default function CobrosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Cobros</h1>
        <p className="text-sm text-muted-foreground">Un mismo pago puede distribuirse entre OT específicas, acopio o cuenta corriente</p>
      </div>

      <div className="space-y-3">
        {payments.map((p, i) => {
          const client = getClient(p.clienteId);
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vase-green-soft text-vase-green-dark">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold">{p.numero} · {client?.razonSocial}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.fecha)} · {methodLabels[p.metodo]}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-vase-green">
                      {p.moneda === "USD" ? `US$ ${p.importe.toLocaleString("en-US")}` : formatARS(p.importe)}
                    </p>
                    {p.moneda === "USD" && (
                      <p className="text-xs text-muted-foreground">
                        TC {p.tipoCambio} → {formatARS(p.montoEquivalenteArs ?? 0)}
                      </p>
                    )}
                  </div>
                </div>

                {p.retencionMonto > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">Retención aplicada: {formatARS(p.retencionMonto)}</p>
                )}

                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Distribución del pago</p>
                  <div className="flex flex-wrap gap-2">
                    {p.allocations.map((a, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {a.target === "OT_ESPECIFICA" ? "OT" : a.target === "ACOPIO" ? "Acopio" : "Cta. Cte."} · {a.refLabel} · {formatARS(a.monto)}
                      </Badge>
                    ))}
                  </div>
                </div>
                {p.observaciones && <p className="mt-3 text-xs text-muted-foreground italic">{p.observaciones}</p>}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
