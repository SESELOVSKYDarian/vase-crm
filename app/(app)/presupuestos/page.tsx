"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, FileText, Layers, Send, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { QuoteStatusBadge, TipoFacturacionBadge } from "@/components/shared/status-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { formatARS, formatDate, formatM2 } from "@/lib/format";
import type { QuoteStatus, QuoteType } from "@/types";

export default function PresupuestosPage() {
  const [estado, setEstado] = useState<QuoteStatus | "TODOS">("TODOS");
  const [tipo, setTipo] = useState<QuoteType | "TODOS">("TODOS");
  const [showNew, setShowNew] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [deleteQuote, setDeleteQuote] = useState<any | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/quotes").then((r) => r.ok ? r.json() : null).then((payload) => setRows(payload?.data ?? [])).catch(() => setRows([])); }, []);
  async function sendQuote(id: string) { const response = await fetch(`/api/quotes/${id}/send`, { method: "POST" }); if (response.ok) setRows((items) => items.map((item) => item.id === id ? { ...item, estado: "ENVIADO" } : item)); else setMessage((await response.json().catch(() => null))?.error ?? "No se pudo enviar el presupuesto"); }
  async function removeQuote() { if (!deleteQuote) return; const response = await fetch(`/api/quotes/${deleteQuote.id}`, { method: "DELETE" }); if (response.ok) setRows((items) => items.filter((item) => item.id !== deleteQuote.id)); else setMessage("No se pudo eliminar el borrador"); setDeleteQuote(null); }

  const filtered = rows.filter(
    (q) => (estado === "TODOS" || q.estado === estado) && (tipo === "TODOS" || q.tipo === tipo)
      && (!showDrafts || q.estado === "BORRADOR")
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">{rows.length} presupuestos totales</p>
        </div>
        <div className="flex items-center gap-2"><Button variant={showDrafts ? "secondary" : "outline"} onClick={() => setShowDrafts((value) => !value)}>Mis borradores</Button><div className="relative">
          <Button onClick={() => setShowNew((v) => !v)}>
            <Plus className="h-4 w-4" /> Nuevo presupuesto
          </Button>
          {showNew && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-vase-lg"
            >
              <Link href="/presupuestos/nuevo/simple" className="flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-secondary">
                <FileText className="h-4 w-4 text-vase-green" /> Vidrio simple
              </Link>
              <Link href="/presupuestos/nuevo/dvh" className="flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-secondary border-t border-border">
                <Layers className="h-4 w-4 text-vase-green" /> DVH
              </Link>
            </motion.div>
          )}
        </div></div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="max-w-[160px]">
          <option value="TODOS">Todos los tipos</option>
          <option value="SIMPLE">Vidrio simple</option>
          <option value="DVH">DVH</option>
        </Select>
        <Select value={estado} onChange={(e) => setEstado(e.target.value as any)} className="max-w-[180px]">
          <option value="TODOS">Todos los estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="ENVIADO">Enviado</option>
          <option value="APROBADO">Aprobado</option>
          <option value="RECHAZADO">Rechazado</option>
          <option value="VENCIDO">Vencido</option>
          <option value="ANULADO">Anulado</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No hay presupuestos con estos filtros" description="Ajustá los filtros o creá un nuevo presupuesto." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">N°</th>
                <th className="px-4 py-3">Cliente / Obra</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fact.</th>
                <th className="px-4 py-3 text-right">m²</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, i) => {
                const client = q.client;
                return (
                  <motion.tr
                    key={q.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/presupuestos/${q.id}`} className="font-medium text-foreground hover:text-vase-green">
                        {q.numero}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(q.fecha)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{client?.razonSocial ?? "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">{q.obra}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{q.tipo}</td>
                    <td className="px-4 py-3"><TipoFacturacionBadge tipo={q.tipoFacturacion} /></td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatM2(q.m2Total)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatARS(q.total)}</td>
                    <td className="px-4 py-3"><QuoteStatusBadge status={q.estado} /></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-2">{q.estado === "BORRADOR" && <><Link href={`/presupuestos/${q.id}`}><Button size="sm" variant="outline">Editar</Button></Link><Button size="sm" variant="outline" onClick={() => sendQuote(q.id)}><Send className="h-3.5 w-3.5" /> Enviar</Button><Button size="sm" variant="outline" onClick={() => setDeleteQuote(q)}><Trash2 className="h-3.5 w-3.5" /></Button></>}{q.estado === "ENVIADO" && <Link href={`/presupuestos/${q.id}`}><Button size="sm">Revisar y decidir</Button></Link>}{q.estado === "APROBADO" && q.workOrder && <Link href={`/presupuestos/${q.id}`}><Button size="sm" variant="outline">Ver OT</Button></Link>}</div></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <Modal open={!!deleteQuote} onClose={() => setDeleteQuote(null)} title="Eliminar borrador" description="Esta acción no se puede deshacer." footer={<><Button variant="outline" onClick={() => setDeleteQuote(null)}>Cancelar</Button><Button onClick={removeQuote} className="bg-red-600 hover:bg-red-700">Sí, eliminar</Button></>}><p className="text-sm text-muted-foreground">¿Seguro que querés eliminar el borrador {deleteQuote?.numero}?</p></Modal>
      <Modal open={!!message} onClose={() => setMessage("")} title="No se pudo completar la acción" footer={<Button onClick={() => setMessage("")}>Entendido</Button>}><p className="text-sm text-muted-foreground">{message}</p></Modal>
    </div>
  );
}
