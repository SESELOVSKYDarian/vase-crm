"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  FileText,
  Factory,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Search,
  Sun,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import { useTheme } from "@/lib/use-theme";

type ResultGroup = {
  key: string;
  label: string;
  icon: typeof Users;
  href: (id: string) => string;
};

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const { theme, toggle } = useTheme();
  const groups: ResultGroup[] = [
    {
      key: "clients",
      label: "Clientes",
      icon: Users,
      href: (id) => `/clientes/${id}`,
    },
    {
      key: "quotes",
      label: "Presupuestos",
      icon: FileText,
      href: (id) => `/presupuestos/${id}`,
    },
    {
      key: "workOrders",
      label: "Producción",
      icon: Factory,
      href: () => "/produccion",
    },
    {
      key: "invoices",
      label: "Facturas",
      icon: Receipt,
      href: () => "/facturacion",
    },
    {
      key: "deliveryNotes",
      label: "Remitos",
      icon: Truck,
      href: () => "/remitos",
    },
  ];

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setUser(data.user));
    fetch("/api/notifications").then((r) => r.ok ? r.json() : null).then((payload) => { setNotifications(payload?.data ?? []); setUnreadCount(payload?.unreadCount ?? 0); });
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(value)}`,
      );
      setResults(response.ok ? await response.json() : {});
    } catch {
      setResults({});
    }
  }
  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    setNotifications((items) => items.map((item) => ({ ...item, readAt: new Date().toISOString() }))); setUnreadCount(0);
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  const initials = (user?.name ?? "Usuario")
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex min-h-[76px] items-center gap-3 border-b border-border/70 bg-background/80 px-3 backdrop-blur-xl sm:px-5 lg:px-8">
      <button
        onClick={onOpenMenu}
        aria-label="Abrir menú"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card text-muted-foreground shadow-[0_8px_20px_-16px_rgba(15,23,42,.5)] transition-[transform,background-color,color] duration-150 hover:-translate-y-0.5 hover:bg-vase-green-soft hover:text-vase-green focus-visible:ring-2 focus-visible:ring-vase-green lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="relative min-w-0 flex-1 max-w-[44rem]">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => search(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "/") {
              e.preventDefault();
              searchRef.current?.focus();
            }
          }}
          placeholder="Buscar cliente, presupuesto, OT o factura…"
          aria-label="Buscar en Vase CRM"
          className="h-11 w-full rounded-2xl border border-border/80 bg-card/90 pl-11 pr-20 text-sm shadow-[0_8px_20px_-16px_rgba(15,23,42,.5)] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground focus:border-vase-green/50 focus:bg-card focus:ring-4 focus:ring-vase-green/10"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
          ⌘ K
        </kbd>
        {results && (
          <div className="absolute left-0 right-0 top-12 z-50 max-h-[min(70vh,460px)] overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-vase-lg">
            {groups.flatMap((group) =>
              (results[group.key] ?? []).map((item: any) => {
                const Icon = group.icon;
                const label =
                  item.razonSocial ?? item.numero ?? item.nombre ?? item.obra;
                return (
                  <Link
                    key={`${group.key}-${item.id}`}
                    href={group.href(item.id)}
                    onClick={() => setResults(null)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-vase-green-soft text-vase-green">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {group.label}
                      </span>
                    </span>
                  </Link>
                );
              }),
            )}
            {groups.every((group) => !(results[group.key] ?? []).length) && (
              <p className="p-5 text-center text-sm text-muted-foreground">
                No encontramos resultados
              </p>
            )}
          </div>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-border/70 pl-3 sm:gap-2 sm:pl-4">
        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-[transform,background-color,color,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-vase-green"
        >
          {theme === "dark" ? (
            <Sun className="theme-toggle-icon h-4 w-4" />
          ) : (
            <Moon className="theme-toggle-icon h-4 w-4" />
          )}
        </button>
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications((value) => !value);
              setShowProfile(false);
            }}
            aria-label="Abrir notificaciones"
            aria-expanded={showNotifications}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-vase-green"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full bg-vase-green ring-2 ring-card" />
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-vase-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Notificaciones</p>
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-vase-green hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Marcar leídas
                </button>
              </div>
              {notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.entityType === "WorkOrder" ? "/produccion" : "/dashboard"}
                  onClick={async () => { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) }); setShowNotifications(false); }}
                  className={`block border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-secondary ${item.readAt ? "opacity-60" : ""}`}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.message}
                  </p>
                </Link>
              ))}
              {!notifications.length && <p className="p-5 text-center text-sm text-muted-foreground">No tenés notificaciones nuevas.</p>}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => {
              setShowProfile((value) => !value);
              setShowNotifications(false);
            }}
            aria-label="Abrir menú de perfil"
            aria-expanded={showProfile}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-2.5 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-vase-green"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-vase-green text-[11px] font-bold text-white">
              {initials}
            </span>
            <span className="hidden max-w-36 text-left sm:block">
              <span className="block truncate text-xs font-semibold">
                {user?.name ?? "Usuario"}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {user?.roles?.join(", ") ?? user?.role ?? ""}
              </span>
            </span>
            <ChevronDown
              className={`hidden h-3.5 w-3.5 text-muted-foreground transition-transform sm:block ${showProfile ? "rotate-180" : ""}`}
            />
          </button>
          {showProfile && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border bg-card p-1.5 shadow-vase-lg">
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-sm font-semibold">
                  {user?.name ?? "Usuario"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email ?? ""}
                </p>
              </div>
              <Link
                href="/perfil"
                onClick={() => setShowProfile(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-secondary"
              >
                <UserRound className="h-4 w-4 text-muted-foreground" /> Mi
                perfil
              </Link>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
