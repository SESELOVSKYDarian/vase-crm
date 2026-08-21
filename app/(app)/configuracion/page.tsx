"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";

const roles = [
  { role: "ADMIN", desc: "Configura precios, usuarios y ARCA. Acceso total." },
  { role: "ADMINISTRACION", desc: "Maneja facturación, cobranzas y cuenta corriente." },
  { role: "VENTAS", desc: "Crea y aprueba presupuestos. No autoriza pagos." },
  { role: "PRODUCCION", desc: "Gestiona OT y avance productivo. No modifica facturas." },
  { role: "CORTE", desc: "Actualiza órdenes de corte." },
  { role: "ARMADO", desc: "Actualiza órdenes de armado DVH." },
  { role: "DEPOSITO", desc: "Genera remitos y controla entregas." },
];

export default function ConfiguracionPage() {
  const [tab, setTab] = useState("empresa");
  const [users, setUsers] = useState<any[]>([]);
  const [openUser, setOpenUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "VENTAS", active: true });
  const [userError, setUserError] = useState("");
  useEffect(() => { fetch("/api/users").then((r) => r.ok ? r.json() : []).then(setUsers).catch(() => {}); }, []);
  async function createUser(e: React.FormEvent) { e.preventDefault(); setUserError(""); const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userForm) }); if (!response.ok) { setUserError((await response.json()).error ?? "No se pudo crear"); return; } setOpenUser(false); setUserForm({ name: "", email: "", password: "", role: "VENTAS", active: true }); }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">Empresa, integración ARCA, usuarios y permisos</p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "empresa", label: "Empresa" },
          { value: "arca", label: "ARCA" },
          { value: "usuarios", label: "Usuarios" },
          { value: "roles", label: "Roles y permisos" },
        ]}
      />

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === "empresa" && (
          <Card className="p-5 max-w-2xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Razón social</Label>
                <Input defaultValue="WTA S.A." />
              </div>
              <div>
                <Label>CUIT</Label>
                <Input defaultValue="30-12345678-9" />
              </div>
              <div>
                <Label>Condición IVA</Label>
                <Select defaultValue="RESPONSABLE_INSCRIPTO">
                  <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                </Select>
              </div>
              <div>
                <Label>Punto de venta por defecto</Label>
                <Input defaultValue="0003" />
              </div>
            </div>
            <Button className="mt-4">Guardar cambios</Button>
          </Card>
        )}

        {tab === "arca" && (
          <div className="space-y-4 max-w-2xl">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Entorno activo</p>
                  <p className="text-xs text-muted-foreground">Cambiar a producción requiere certificado digital válido</p>
                </div>
                <Badge variant="warning">HOMOLOGACIÓN</Badge>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Certificado digital (.crt)</Label>
                  <Input type="file" />
                </div>
                <div>
                  <Label>Clave privada (.key)</Label>
                  <Input type="file" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-vase-green" /> Los certificados se almacenan cifrados en el servidor y nunca se exponen al frontend.
              </p>
              <Button className="mt-4" variant="outline">Probar conexión WSAA</Button>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-semibold mb-1">Último Ticket de Acceso</p>
              <p className="text-xs text-muted-foreground">Sin solicitudes registradas en este entorno todavía.</p>
            </Card>
          </div>
        )}

        {tab === "roles" && (
          <Card className="divide-y divide-border">
            <div className="flex items-center justify-between px-5 py-4"><div><p className="text-sm font-semibold">Usuarios del sistema</p><p className="text-xs text-muted-foreground">Administrá accesos y permisos</p></div><Button size="sm" onClick={() => setOpenUser(true)}><Plus className="h-4 w-4" /> Agregar usuario</Button></div>
            {roles.map((r) => (
              <div key={r.role} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold">{r.role}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
              </div>
            ))}
          </Card>
        )}
        {tab === "usuarios" && <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-border p-5"><div><p className="text-sm font-semibold">Usuarios del sistema</p><p className="text-xs text-muted-foreground">Administrá accesos, estados y roles.</p></div><Button size="sm" onClick={() => setOpenUser(true)}><Plus className="h-4 w-4" /> Agregar usuario</Button></div><div className="divide-y divide-border">{users.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No hay usuarios cargados o falta conectar la base de datos.</p> : users.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email} · {user.role}</p></div><Badge variant={user.active ? "success" : "neutral"}>{user.active ? "Activo" : "Inactivo"}</Badge></div>)}</div></Card>}
      </motion.div>
      <Modal open={openUser} onClose={() => setOpenUser(false)} title="Agregar usuario" description="Creá un acceso con el rol correspondiente." footer={<><Button variant="outline" onClick={() => setOpenUser(false)}>Cancelar</Button><Button form="user-form" type="submit">Crear usuario</Button></>}>
        <form id="user-form" onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="user-name">Nombre completo</Label><Input id="user-name" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="user-email">Email</Label><Input id="user-email" type="email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></div>
          <div><Label htmlFor="user-password">Contraseña inicial</Label><Input id="user-password" type="password" minLength={8} required value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></div>
          <div><Label htmlFor="user-role">Rol</Label><Select id="user-role" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>{roles.map((r) => <option key={r.role}>{r.role}</option>)}</Select></div>
          {userError && <p className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{userError}</p>}
        </form>
      </Modal>
    </div>
  );
}
