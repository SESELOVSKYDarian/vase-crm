"use client";

import { Search, Bell, Moon, Sun, FileText, Users, Factory, Receipt, Truck, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/use-theme";

export function Topbar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const { theme, toggle } = useTheme();
  useEffect(() => { fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((data) => data && setUser(data.user)); }, []);
  const notifications = [{ id: "ot", title: "OT-2001 está atrasada", detail: "Torre Rivadavia - Piso 8", href: "/produccion" }, { id: "pay", title: "Factura pendiente de cobro", detail: "0003-00012845", href: "/facturacion" }];
  useEffect(() => { try { setReadNotifications(JSON.parse(localStorage.getItem("vase-crm-read-notifications") ?? "[]")); } catch {} }, []);
  function markAllRead() { setReadNotifications(notifications.map((item) => item.id)); localStorage.setItem("vase-crm-read-notifications", JSON.stringify(notifications.map((item) => item.id))); }
  async function search(value: string) { setQuery(value); if (value.trim().length < 2) { setResults(null); return; } try { const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`); setResults(await response.json()); } catch { setResults({}); } }
  const groups = results ? [{ key: "clients", label: "Clientes", icon: Users, href: (id: string) => `/clientes/${id}` }, { key: "quotes", label: "Presupuestos", icon: FileText, href: (id: string) => `/presupuestos/${id}` }, { key: "workOrders", label: "Producción", icon: Factory, href: () => "/produccion" }, { key: "invoices", label: "Facturas", icon: Receipt, href: () => "/facturacion" }, { key: "deliveryNotes", label: "Remitos", icon: Truck, href: () => "/remitos" }] : [];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 lg:px-6 backdrop-blur-md">
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          onKeyDown={(e) => { if (e.key === "/") { e.preventDefault(); e.currentTarget.focus(); } }}
          placeholder="Buscar cliente, CUIT, presupuesto, OT, factura, remito, obra…"
          className="h-9 w-full rounded-lg border border-border bg-secondary/50 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-vase-green focus-visible:ring-1 focus-visible:ring-vase-green"
        />
        {results && <div className="absolute left-0 right-0 top-11 z-40 max-h-[min(70vh,420px)] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-vase-lg">{groups.flatMap((group) => (results[group.key] ?? []).map((item: any) => { const Icon = group.icon; const label = item.razonSocial ?? item.numero ?? item.nombre ?? item.obra; return <Link key={`${group.key}-${item.id}`} href={group.href(item.id)} onClick={() => setResults(null)} className="flex items-center gap-3 rounded-lg p-2.5 text-sm hover:bg-secondary"><Icon className="h-4 w-4 text-vase-green" /><span><span className="block font-medium">{label}</span><span className="block text-xs text-muted-foreground">{group.label}</span></span></Link>; }))}{groups.every((g) => !(results[g.key] ?? []).length) && <p className="p-4 text-center text-sm text-muted-foreground">No encontramos resultados</p>}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          aria-label="Cambiar tema"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          aria-label="Notificaciones"
          onClick={() => setShowNotifications((value) => !value)}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors"
        >
          <Bell className="h-4 w-4" />
          {readNotifications.length < notifications.length && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-vase-green" />}
        </button>
        {showNotifications && <div className="absolute right-4 top-14 z-40 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-border bg-card p-2 shadow-vase-lg"><div className="flex items-center justify-between border-b border-border px-3 py-2"><p className="text-sm font-semibold">Notificaciones</p><button className="text-xs text-vase-green" onClick={markAllRead}><CheckCheck className="mr-1 inline h-3.5 w-3.5" />Marcar leídas</button></div>{notifications.map((notification) => <Link key={notification.id} href={notification.href} onClick={() => { setReadNotifications((current) => [...new Set([...current, notification.id])]); setShowNotifications(false); }} className={`block rounded-lg p-3 hover:bg-secondary ${readNotifications.includes(notification.id) ? "opacity-60" : ""}`}><p className="text-sm font-medium">{notification.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{notification.detail}</p></Link>)}</div>}
        <div className="relative ml-1 flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-vase-green text-[11px] font-bold text-white">
            {(user?.name ?? "Admin").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block leading-none">
            <Link href="/perfil" className="text-xs font-semibold hover:text-vase-green">{user?.name ?? "Usuario"}</Link>
            <p className="text-[10px] text-muted-foreground">{user?.roles?.join(", ") ?? user?.role ?? ""}</p>
          </div>
          <button className="ml-1 text-xs text-muted-foreground hover:text-red-600" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}>Salir</button>
        </div>
      </div>
    </header>
  );
}
