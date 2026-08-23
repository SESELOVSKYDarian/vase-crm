"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { WorkOrderStatusBadge } from "@/components/shared/status-badges";
import { formatDate, formatM2 } from "@/lib/format";
import type { WorkOrderStatus } from "@/types";
import { Layers, FileText, GripVertical, Check, Loader2 } from "lucide-react";

const COLUMNS: { key: WorkOrderStatus; label: string }[] = [
  { key: "PENDIENTE", label: "Pendientes" },
  { key: "EN_PROCESO", label: "En proceso" },
  { key: "TERMINADA", label: "Terminadas" },
  { key: "ANULADA", label: "Anuladas" },
];

export default function ProduccionPage() {
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState("TODAS");
  const [orders, setOrders] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/work-orders").then((response) => response.ok ? response.json() : null).then((payload) => setOrders(payload?.data ?? [])).catch(() => setOrders([])); }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const client = o.client;
      const matchesQuery = [o.numero, o.obra, client?.razonSocial].join(" ").toLowerCase().includes(query.toLowerCase());
      const matchesCategoria = categoria === "TODAS" || o.categoria === categoria;
      return matchesQuery && matchesCategoria;
    });
  }, [orders, query, categoria]);

  async function moveOrder(id: string, status: WorkOrderStatus) {
    const previous = orders;
    setOrders((items) => items.map((item) => item.id === id ? { ...item, estadoProductivo: status } : item));
    setSaving(id);
    try {
      const response = await fetch(`/api/work-orders/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error();
    } catch { setOrders(previous); setError("No se pudo mover la orden. Verificá que tu usuario tenga permiso."); }
    finally { setSaving(null); setDragged(null); }
  }

  const today = new Date("2026-08-20");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Producción</h1>
        <p className="text-sm text-muted-foreground">Tablero de órdenes de trabajo — corte, armado y avance general</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Buscar por OT, obra o cliente…" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="max-w-[160px]">
          <option value="TODAS">Todas las categorías</option>
          <option value="SIMPLE">Simple</option>
          <option value="DVH">DVH</option>
          <option value="TEMPLADO">Templado</option>
        </Select>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = filtered.filter((o) => o.estadoProductivo === col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold">{col.label}</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className={`space-y-3 min-h-[120px] rounded-xl p-1 transition-colors ${dragged ? "bg-vase-green-soft/50" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={() => dragged && moveOrder(dragged, col.key)}>
                <AnimatePresence>
                  {items.map((o, i) => {
                    const client = o.client;
                    const atrasada = new Date(o.fechaEntrega) < today && o.estadoProductivo !== "TERMINADA";
                    return (
                      <motion.div
                        key={o.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.03 }}
                        draggable
                        onDragStart={() => setDragged(o.id)}
                        onDragEnd={() => setDragged(null)}
                      >
                        <Card className={`group cursor-grab p-4 active:cursor-grabbing ${atrasada ? "border-red-300" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <GripVertical className="h-4 w-4 opacity-50" aria-label="Arrastrar orden" />
                              {o.tipo === "DVH" ? <Layers className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                              {o.numero}
                            </div>
                            <div className="flex items-center gap-2">{saving === o.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-vase-green" />}{atrasada && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">Atrasada</span>}</div>
                          </div>
                          <p className="mt-1.5 text-sm font-medium">{o.obra}</p>
                          <p className="text-xs text-muted-foreground">{client?.razonSocial}</p>
                          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${o.porcentajeAvance}%` }}
                              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                              className="h-full rounded-full bg-vase-green"
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{o.porcentajeAvance}% · {formatM2(o.items?.reduce((sum: number, item: any) => sum + Number(item.m2 ?? 0), 0) ?? 0)}</span>
                            <span>Entrega {formatDate(o.fechaEntrega)}</span>
                          </div>
                          {o.operario && <p className="mt-1.5 text-[11px] text-muted-foreground">Operario: {o.operario}</p>}
                          <label className="sr-only" htmlFor={`move-${o.id}`}>Mover {o.numero}</label>
                          <select id={`move-${o.id}`} value={o.estadoProductivo} onChange={(e) => moveOrder(o.id, e.target.value as WorkOrderStatus)} className="mt-3 h-8 w-full rounded-md border border-border bg-background px-2 text-xs md:opacity-0 md:transition-opacity md:group-hover:opacity-100 focus:opacity-100">
                            {COLUMNS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                          </select>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                    Sin OT en esta columna
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
