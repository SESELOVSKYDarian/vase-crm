"use client";

import { Card } from "@/components/ui/card";
import { DeliveryStatusBadge } from "@/components/shared/status-badges";
import { workOrders, getClient } from "@/lib/mock-data";
import { formatDate, formatM2 } from "@/lib/format";
import { motion } from "framer-motion";

export default function EntregasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Entregas</h1>
        <p className="text-sm text-muted-foreground">Estado de entrega por orden de trabajo, independiente del estado productivo</p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">OT</th>
              <th className="px-4 py-3">Cliente / Obra</th>
              <th className="px-4 py-3 text-right">Solicitado</th>
              <th className="px-4 py-3 text-right">Entregado</th>
              <th className="px-4 py-3 text-right">Pendiente</th>
              <th className="px-4 py-3">m²</th>
              <th className="px-4 py-3">Estado de entrega</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((o, i) => {
              const client = getClient(o.clienteId);
              const pendiente = o.cantidadTotal - o.cantidadEntregada;
              return (
                <motion.tr
                  key={o.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border last:border-0 hover:bg-secondary/40"
                >
                  <td className="px-4 py-3 font-medium">{o.numero}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{client?.razonSocial}</p>
                    <p className="text-xs text-muted-foreground">{o.obra}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.cantidadTotal}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-vase-green">{o.cantidadEntregada}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{pendiente}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatM2(o.m2Total)}</td>
                  <td className="px-4 py-3"><DeliveryStatusBadge status={o.estadoEntrega} /></td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
