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
  X, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  const [hovered, setHovered] = useState(false);
  const expanded = !collapsed || hovered;

  return (
    <><div className={`fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm transition-opacity lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onCloseMobile} /><aside onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className={cn("fixed inset-y-0 left-0 z-50 flex w-[280px] shrink-0 flex-col border-r border-slate-200/80 bg-white/95 shadow-[12px_0_40px_-24px_rgba(15,23,42,.35)] backdrop-blur-xl transition-[width,transform] duration-300 ease-out lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0 dark:border-slate-800 dark:bg-slate-950/95", mobileOpen ? "translate-x-0" : "-translate-x-full", expanded ? "lg:w-[280px]" : "lg:w-[76px]")}>
      <div className={cn("flex h-[76px] items-center border-b border-slate-200/80 transition-[padding] duration-300 dark:border-slate-800", expanded ? "gap-3 px-5" : "justify-center px-2")}>
        <motion.div whileHover={{ rotate: -8, scale: 1.05 }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vase-green text-white shadow-vase-glow">
          <Droplets className="h-4.5 w-4.5" strokeWidth={2.5} />
        </motion.div>
        <div className={cn("overflow-hidden whitespace-nowrap leading-none transition-[opacity,width,transform] duration-300", !expanded && "lg:w-0 lg:scale-95 lg:opacity-0")}>
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
                "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200",
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
              <motion.span whileHover={{ scale: 1.12 }} className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"><Icon className="h-[18px] w-[18px]" strokeWidth={2} /></motion.span>
              <span className={cn("relative overflow-hidden whitespace-nowrap transition-[opacity,width] duration-300", !expanded && "lg:w-0 lg:opacity-0")}>{item.label}</span>
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
