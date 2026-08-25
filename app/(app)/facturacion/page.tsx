"use client";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatARS, formatDate } from "@/lib/format";
import { Receipt, Wallet, Search, Pencil, Trash2, History, Printer } from "lucide-react";
export default function FacturacionPage() {
  const [invoices, setInvoices] = useState<any[]>([]),
    [notes, setNotes] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [search, setSearch] = useState(""),
    [type, setType] = useState("N"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<any>(null),
    [remove, setRemove] = useState<any>(null),
    [audit, setAudit] = useState<any[]>([]),
    [showAudit, setShowAudit] = useState(false);
  const load = () =>
    Promise.all([
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/delivery-notes").then((r) => r.json()),
    ]).then(([a, b]) => {
      setInvoices(a.data ?? []);
      setNotes((b.data ?? []).filter((n: any) => n.estado === "CONFIRMADO"));
    });
  useEffect(() => {
    load();
  }, []);
  const suggestions = useMemo(
    () =>
      notes
        .filter((n) =>
          `${n.numero} ${n.workOrder?.numero} ${n.client?.razonSocial}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .slice(0, 8),
    [notes, search],
  );
  async function create() {
    if (!selected) return;
    setBusy(true);
    const r = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workOrderId: selected.workOrderId,
        tipoFacturacion: type,
      }),
    });
    if (!r.ok)
      setError(
        (await r.json().catch(() => null))?.error ?? "No se pudo emitir",
      );
    else {
      setOpen(false);
      load();
    }
    setBusy(false);
  }
  async function removeInvoice() {
    setBusy(true);
    const r = await fetch(`/api/invoices/${remove.id}`, { method: "DELETE" });
    if (!r.ok)
      setError(
        (await r.json().catch(() => null))?.error ?? "No se pudo borrar",
      );
    else {
      setRemove(null);
      load();
    }
    setBusy(false);
  }
  async function saveEdit() {
    setBusy(true);
    const r = await fetch(`/api/invoices/${edit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cuit: edit.cuit,
        puntoVenta: Number(edit.puntoVenta),
      }),
    });
    if (!r.ok)
      setError(
        (await r.json().catch(() => null))?.error ?? "No se pudo editar",
      );
    else {
      setEdit(null);
      load();
    }
    setBusy(false);
  }
  async function history() {
    const r = await fetch("/api/audit?entidad=Invoice");
    setAudit((await r.json()).data ?? []);
    setShowAudit(true);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Facturación</h1>
          <p className="text-sm text-muted-foreground">
            Comprobantes emitidos y trazabilidad.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={history}>
            <History className="h-4 w-4" /> Historial
          </Button>
          <Button
            onClick={() => {
              setSelected(null);
              setSearch("");
              setError("");
              setOpen(true);
            }}
            disabled={!notes.length}
          >
            <Receipt className="h-4 w-4" /> Generar factura
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {invoices.map((i) => (
          <Card
            key={i.id}
            className="flex flex-wrap items-center justify-between gap-4 p-5"
          >
            <div>
              <p className="font-semibold">
                {i.numero} · {i.tipoFacturacion}
              </p>
              <p className="text-sm text-muted-foreground">
                {i.client?.razonSocial} · OT {i.workOrder?.numero} ·{" "}
                {formatDate(i.fecha)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <b>{formatARS(Number(i.total))}</b>
              <Button size="sm" variant="outline" onClick={() => (window.location.href = `/facturacion/${i.id}/imprimir`)}>
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  (window.location.href = `/cobros?clientId=${i.clientId}&invoiceId=${i.id}`)
                }
              >
                <Wallet className="h-4 w-4" /> Cobrar
              </Button>
              <Button
                size="icon"
                variant="outline"
                title="Editar"
                onClick={() =>
                  setEdit({ id: i.id, cuit: i.cuit, puntoVenta: i.puntoVenta })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                title="Borrar"
                onClick={() => setRemove(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
        {!invoices.length && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Todavía no hay facturas persistidas.
          </Card>
        )}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Generar factura"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy || !selected} onClick={create}>
              {busy ? "Emitiendo…" : "Emitir factura"}
            </Button>
          </>
        }
      >
        <Label>Buscar remito confirmado</Label>
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(null);
          }}
          placeholder="Número, OT o cliente"
        />
        {!selected && (
          <div className="mt-2 rounded-xl border bg-card">
            {suggestions.map((n) => (
              <button
                type="button"
                key={n.id}
                className="block w-full p-3 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  setSelected(n);
                  setSearch(n.numero);
                }}
              >
                {n.numero} · OT {n.workOrder?.numero} · {n.client?.razonSocial}
              </button>
            ))}
          </div>
        )}
        {selected && (
          <p className="mt-3 rounded-lg bg-vase-green-soft p-3 text-sm">
            {selected.numero} seleccionado
          </p>
        )}
        <div className="mt-4">
          <Label>Tipo</Label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="N">Tipo N · Interna</option>
            <option value="A">Tipo A · ARCA</option>
          </Select>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Modal>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title="Editar factura"
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={saveEdit}>
              Guardar cambios
            </Button>
          </>
        }
      >
        <Label>CUIT</Label>
        <Input
          value={edit?.cuit ?? ""}
          onChange={(e) => setEdit({ ...edit, cuit: e.target.value })}
        />
        <Label>Punto de venta</Label>
        <Input
          type="number"
          value={edit?.puntoVenta ?? ""}
          onChange={(e) => setEdit({ ...edit, puntoVenta: e.target.value })}
        />
      </Modal>
      <Modal
        open={!!remove}
        onClose={() => setRemove(null)}
        title="¿Borrar factura?"
        description="Esta acción queda registrada y no se puede deshacer."
        footer={
          <>
            <Button variant="outline" onClick={() => setRemove(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={removeInvoice}>
              Borrar factura
            </Button>
          </>
        }
      />
      <Modal
        open={showAudit}
        onClose={() => setShowAudit(false)}
        title="Historial de facturas"
        description="Cambios y eliminaciones registrados"
      >
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {audit.length ? (
            audit.map((a) => (
              <div key={a.id} className="rounded-lg border p-3 text-sm">
                <b>{a.accion}</b>
                <span className="ml-2 text-muted-foreground">
                  {formatDate(a.createdAt)} · {a.user?.name ?? "Sistema"}
                </span>
                <pre className="mt-2 whitespace-pre-wrap text-xs">
                  {JSON.stringify(
                    { anterior: a.valorAnterior, nuevo: a.valorNuevo },
                    null,
                    2,
                  )}
                </pre>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin movimientos registrados.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
