"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FileText,
  Factory,
  Scissors,
  Layers,
  Truck,
  ClipboardList,
  Receipt,
  Wallet,
  BookText,
  BarChart3,
  Tag,
  Settings,
  Droplets,
  Menu, X, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/produccion", label: "Producción", icon: Factory },
  { href: "/entregas", label: "Entregas", icon: Truck },
  { href: "/remitos", label: "Remitos", icon: ClipboardList },
  { href: "/facturacion", label: "Facturación", icon: Receipt },
  { href: "/cobros", label: "Cobros", icon: Wallet },
  { href: "/cuenta-corriente", label: "Cuenta corriente", icon: BookText },
  { href: "/analiticas", label: "Analíticas", icon: BarChart3 },
  { href: "/precios", label: "Precios", icon: Tag },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggle }: { collapsed: boolean; mobileOpen: boolean; onCloseMobile: () => void; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <><div className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onCloseMobile} /><aside className={cn("fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-border bg-card/95 shadow-vase-lg backdrop-blur-xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0 lg:bg-card/60 lg:shadow-none", mobileOpen ? "translate-x-0" : "-translate-x-full", collapsed && "lg:w-20")}>
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vase-green text-white shadow-vase-glow">
          <Droplets className="h-4.5 w-4.5" strokeWidth={2.5} />
        </div>
        <div className={cn("leading-none transition-opacity", collapsed && "lg:hidden")}>
          <p className="text-sm font-bold tracking-tight">Vase</p>
          <p className="text-[10px] font-medium text-muted-foreground tracking-wide">CRM</p>
        </div>
      </div>
      <button onClick={onCloseMobile} aria-label="Cerrar menú" className="absolute right-3 top-4 rounded-lg p-2 text-muted-foreground hover:bg-secondary lg:hidden"><X className="h-4 w-4" /></button>
      <button onClick={onToggle} aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"} className="absolute -right-3 top-20 hidden h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground lg:flex">{collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}</button>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "text-vase-green" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-vase-green-soft"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <Icon className="relative h-4 w-4 shrink-0" strokeWidth={2} />
              <span className={cn("relative transition-opacity", collapsed && "lg:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-xs font-semibold text-foreground">WTA · Producción vidrio</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Homologación ARCA activa</p>
        </div>
      </div>
    </aside></>
  );
}
