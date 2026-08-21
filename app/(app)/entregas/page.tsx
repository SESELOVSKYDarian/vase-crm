"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DeliveryStatusBadge } from "@/components/shared/status-badges";
import { workOrders, getClient } from "@/lib/mock-data";
import { formatM2 } from "@/lib/format";
import { motion } from "framer-motion";
import { Truck } from "lucide-react";

export default function EntregasPage() {
  const [orders, setOrders] = useState<any[]>(workOrders);
  const [selected, setSelected] = useState<any | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetch("/api/work-orders").then((response) => response.ok ? response.json() : null).then((payload) => { if (payload?.data?.length) setOrders(payload.data); }).catch(() => {}); }, []);
  async function saveDelivery() { if (!selected) return; setSaving(true); setError(""); const response = await fetch(`/api/work-orders/${selected.id}/delivery`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity }) }); const payload = await response.json().catch(() => null); setSaving(false); if (!response.ok) { setError(payload?.error ?? "No se pudo registrar la entrega"); return; } setOrders((items) => items.map((item) => item.id === selected.id ? { ...item, ...payload.data } : item)); setSelected(null); }
  return <div className="space-y-6"><div><h1 className="page-title">Entregas</h1><p className="page-subtitle">Registrá entregas parciales o completas sin modificar el estado de producción.</p></div><Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-muted-foreground"><th className="px-4 py-3">OT</th><th className="px-4 py-3">Cliente / Obra</th><th className="px-4 py-3 text-right">Solicitado</th><th className="px-4 py-3 text-right">Entregado</th><th className="px-4 py-3 text-right">Pendiente</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acción</th></tr></thead><tbody>{orders.map((order, index) => { const client = order.client ?? getClient(order.clienteId); const pending = order.cantidadTotal - order.cantidadEntregada; return <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.03 }} className="border-b border-border last:border-0 hover:bg-secondary/40"><td className="px-4 py-3 font-medium">{order.numero}</td><td className="px-4 py-3"><p className="font-medium">{client?.razonSocial}</p><p className="text-xs text-muted-foreground">{order.obra}</p></td><td className="px-4 py-3 text-right tabular-nums">{order.cantidadTotal}</td><td className="px-4 py-3 text-right tabular-nums text-vase-green">{order.cantidadEntregada}</td><td className="px-4 py-3 text-right tabular-nums">{pending}</td><td className="px-4 py-3"><DeliveryStatusBadge status={order.estadoEntrega} /></td><td className="px-4 py-3 text-right"><Button size="sm" variant="outline" disabled={pending <= 0} onClick={() => { setSelected(order); setQuantity(Math.max(1, pending)); setError(""); }}><Truck className="h-3.5 w-3.5" /> Registrar</Button></td></motion.tr>; })}</tbody></table></Card><Modal open={!!selected} onClose={() => setSelected(null)} title={`Registrar entrega · ${selected?.numero ?? ""}`} description="La cantidad se acumula y actualiza automáticamente el estado de entrega." footer={<><Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button><Button disabled={saving} onClick={saveDelivery}>{saving ? "Guardando…" : "Confirmar entrega"}</Button></>}><div className="space-y-4"><div><Label>Cantidad entregada</Label><Input type="number" min={1} max={selected ? selected.cantidadTotal - selected.cantidadEntregada : undefined} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></div>{selected && <p className="text-sm text-muted-foreground">Pendiente actual: <b className="text-foreground">{selected.cantidadTotal - selected.cantidadEntregada}</b> unidades · {formatM2(selected.m2Total)}</p>}{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}</div></Modal></div>;
}
