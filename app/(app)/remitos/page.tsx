"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deliveryNotes, getClient, getWorkOrder } from "@/lib/mock-data";
import { formatDate } from "@/lib/format";
import { motion } from "framer-motion";
import { Printer, Download } from "lucide-react";

export default function RemitosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Remitos</h1>
        <p className="text-sm text-muted-foreground">Documentos de entrega — inmutables una vez confirmados</p>
      </div>

      <div className="space-y-3">
        {deliveryNotes.map((r, i) => {
          const client = getClient(r.clienteId);
          const ot = getWorkOrder(r.workOrderId);
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{r.numero}</p>
                      <Badge variant={r.estado === "CONFIRMADO" ? "success" : "danger"}>{r.estado}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{client?.razonSocial} · OT {ot?.numero}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(r.fecha)} · {r.direccion}{r.transportista && ` · ${r.transportista}`}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"><Printer className="h-3.5 w-3.5" /> Imprimir</Button>
                    <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5" /> PDF</Button>
                  </div>
                </div>
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-1.5">Producto</th>
                      <th className="py-1.5 text-right">Pedido</th>
                      <th className="py-1.5 text-right">Entregado</th>
                      <th className="py-1.5 text-right">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-border last:border-0">
                        <td className="py-1.5">{it.producto}</td>
                        <td className="py-1.5 text-right tabular-nums">{it.cantidadPedida}</td>
                        <td className="py-1.5 text-right tabular-nums text-vase-green">{it.cantidadEntregada}</td>
                        <td className="py-1.5 text-right tabular-nums">{it.cantidadPedida - it.cantidadEntregada}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
