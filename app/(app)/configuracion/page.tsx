"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Save, ShieldCheck } from "lucide-react";
export default function ConfiguracionPage() {
  const [tab, setTab] = useState("empresa"),
    [form, setForm] = useState<any>({
      arcaEnvironment: "HOMOLOGACION",
      puntoVentaDefault: 1,
    }),
    [status, setStatus] = useState(""),
    [users, setUsers] = useState<any[]>([]),
    [roles, setRoles] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/company-settings")
      .then((r) => r.json())
      .then((p) => setForm((x: any) => ({ ...x, ...(p.data ?? {}) })));
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers);
    fetch("/api/roles")
      .then((r) => (r.ok ? r.json() : []))
      .then((p) => setRoles(Array.isArray(p) ? p : []));
  }, []);
  const set = (k: string, v: any) => setForm((x: any) => ({ ...x, [k]: v }));
  function choose(f: File | null) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => set("logoData", String(r.result));
    r.readAsDataURL(f);
  }
  async function save() {
    setStatus("Guardando…");
    const r = await fetch("/api/company-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const p = await r.json().catch(() => null);
    setStatus(
      r.ok
        ? "Configuración guardada correctamente"
        : (p?.error ?? "No se pudo guardar"),
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Empresa, ARCA, usuarios, roles y permisos.
        </p>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "empresa", label: "Empresa" },
          { value: "arca", label: "ARCA y facturación" },
          { value: "usuarios", label: "Usuarios" },
          { value: "roles", label: "Roles y permisos" },
        ]}
      />
      {tab === "empresa" && (
        <Card className="max-w-2xl p-5">
          <div className="flex items-center gap-3">
            <ImagePlus className="h-5 w-5 text-vase-green" />
            <div>
              <p className="font-semibold">Logo de la empresa</p>
              <p className="text-sm text-muted-foreground">
                Se utilizará en presupuestos, remitos y facturas imprimibles.
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-4">
            {form.logoData ? (
              <img
                src={form.logoData}
                alt="Logo actual"
                className="h-20 w-32 rounded-lg border object-contain p-2"
              />
            ) : (
              <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                Sin logo
              </div>
            )}
            <label className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary">
              Elegir imagen
              <input
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => choose(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Razón social</Label>
              <Input
                value={form.razonSocial ?? ""}
                onChange={(e) => set("razonSocial", e.target.value)}
              />
            </div>
            <div>
              <Label>CUIT de la empresa</Label>
              <Input
                value={form.cuit ?? ""}
                onChange={(e) => set("cuit", e.target.value)}
              />
            </div>
          </div>
          <Button className="mt-5" onClick={save}>
            <Save className="h-4 w-4" /> Guardar empresa
          </Button>
        </Card>
      )}
      {tab === "arca" && (
        <Card className="max-w-2xl p-5">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-vase-green" />
            <div>
              <p className="font-semibold">Conexión ARCA / AFIP</p>
              <p className="text-sm text-muted-foreground">
                Usá homologación para pruebas. Producción emite comprobantes
                fiscales reales y requiere certificado vigente.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Ambiente</Label>
              <Select
                value={form.arcaEnvironment ?? "HOMOLOGACION"}
                onChange={(e) => set("arcaEnvironment", e.target.value)}
              >
                <option value="HOMOLOGACION">Homologación (pruebas)</option>
                <option value="PRODUCCION">Producción</option>
              </Select>
            </div>
            <div>
              <Label>CUIT emisor ARCA</Label>
              <Input
                value={form.arcaCuit ?? ""}
                onChange={(e) => set("arcaCuit", e.target.value)}
                placeholder="20-12345678-9"
              />
            </div>
            <div>
              <Label>Punto de venta ARCA</Label>
              <Input
                type="number"
                value={form.arcaPuntoVenta ?? ""}
                onChange={(e) =>
                  set(
                    "arcaPuntoVenta",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                placeholder="Ej. 1"
              />
            </div>
            <div>
              <Label>Punto de venta por defecto</Label>
              <Input
                type="number"
                value={form.puntoVentaDefault ?? 1}
                onChange={(e) =>
                  set("puntoVentaDefault", Number(e.target.value))
                }
              />
            </div>
          </div>
          <div className="mt-5">
            <Label>Certificado X.509 (.crt / .pem)</Label>
            <textarea
              value={
                form.arcaCertificate === "CONFIGURADO"
                  ? ""
                  : (form.arcaCertificate ?? "")
              }
              onChange={(e) => set("arcaCertificate", e.target.value)}
              placeholder={
                form.arcaCertificate === "CONFIGURADO"
                  ? "Certificado configurado. Pegá uno nuevo sólo para reemplazarlo."
                  : "Pegá el contenido del certificado"
              }
              className="mt-1 min-h-28 w-full rounded-lg border bg-background p-3 font-mono text-xs"
            />
          </div>
          <div className="mt-4">
            <Label>Clave privada (.key / .pem)</Label>
            <textarea
              value={
                form.arcaPrivateKey === "CONFIGURADA"
                  ? ""
                  : (form.arcaPrivateKey ?? "")
              }
              onChange={(e) => set("arcaPrivateKey", e.target.value)}
              placeholder={
                form.arcaPrivateKey === "CONFIGURADA"
                  ? "Clave configurada. Pegá una nueva sólo para reemplazarla."
                  : "Pegá el contenido de la clave privada"
              }
              className="mt-1 min-h-28 w-full rounded-lg border bg-background p-3 font-mono text-xs"
            />
          </div>
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Las credenciales no vuelven a mostrarse al navegador. Antes de
            emitir en producción, verificá que el certificado, clave, CUIT y
            punto de venta estén habilitados en ARCA.
          </p>
          <Button className="mt-5" onClick={save}>
            <Save className="h-4 w-4" /> Guardar configuración ARCA
          </Button>
        </Card>
      )}
      {tab === "usuarios" && (
        <Card className="divide-y">
          {users.map((u) => (
            <div key={u.id} className="flex justify-between p-4">
              <span>
                <b>{u.name}</b>
                <small className="ml-2 text-muted-foreground">{u.email}</small>
              </span>
              <Badge>{u.active ? "Activo" : "Inactivo"}</Badge>
            </div>
          ))}
        </Card>
      )}
      {tab === "roles" && (
        <Card className="divide-y">
          {roles.map((r) => (
            <div key={r.id} className="flex justify-between p-4">
              <span>
                <b>{r.name}</b>
                <small className="ml-2 text-muted-foreground">
                  {r.description}
                </small>
              </span>
              <Badge>{r.active ? "Activo" : "Inactivo"}</Badge>
            </div>
          ))}
        </Card>
      )}
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
