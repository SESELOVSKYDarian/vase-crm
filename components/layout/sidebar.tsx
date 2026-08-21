"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, BookText, ClipboardList, Droplets, Factory, FileText, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Receipt, Settings, Tag, Truck, Users, Wallet, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText }, { href: "/produccion", label: "Producción", icon: Factory },
  { href: "/entregas", label: "Entregas", icon: Truck }, { href: "/remitos", label: "Remitos", icon: ClipboardList },
  { href: "/facturacion", label: "Facturación", icon: Receipt }, { href: "/cobros", label: "Cobros", icon: Wallet },
  { href: "/cuenta-corriente", label: "Cuenta corriente", icon: BookText }, { href: "/analiticas", label: "Analíticas", icon: BarChart3 },
  { href: "/precios", label: "Precios", icon: Tag }, { href: "/configuracion", label: "Configuración", icon: Settings },
];

type SidebarProps = { collapsed: boolean; mobileOpen: boolean; onCloseMobile: () => void; onToggle: () => void };

export function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();
  const expanded = !collapsed || hovered;
  const width = expanded ? 280 : 76;

  return <>
    <motion.div initial={false} animate={{ opacity: mobileOpen ? 1 : 0 }} transition={{ duration: 0.16 }} onClick={onCloseMobile} className={cn("fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] lg:hidden", !mobileOpen && "pointer-events-none")} />
    <aside className={cn("relative z-50 shrink-0", collapsed ? "lg:w-[76px]" : "lg:w-[280px]")} aria-label="Navegación principal">
      <motion.div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} initial={false} animate={{ width: mobileOpen || !collapsed ? 280 : width }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 34, mass: 0.7 }} className={cn("fixed inset-y-0 left-0 z-50 flex h-[100dvh] flex-col overflow-hidden border-r border-slate-200/80 bg-white shadow-[12px_0_40px_-26px_rgba(15,23,42,.42)] dark:border-slate-800 dark:bg-slate-950 lg:sticky lg:top-0 lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-slate-200/80 px-[18px] dark:border-slate-800">
          <motion.div whileHover={reduceMotion ? undefined : { scale: 1.04, rotate: -4 }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-vase-green text-white shadow-[0_10px_22px_-12px_rgba(22,163,74,.85)]"><Droplets className="h-5 w-5" strokeWidth={2.4} /></motion.div>
          <motion.div animate={{ opacity: expanded || mobileOpen ? 1 : 0 }} className="min-w-0 whitespace-nowrap"><p className="text-[15px] font-bold tracking-[-0.02em] text-slate-950 dark:text-white">Vase</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">CRM</p></motion.div>
          <button type="button" onClick={onCloseMobile} aria-label="Cerrar menú" className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-vase-green lg:hidden"><X className="h-5 w-5" /></button>
        </div>

        <button type="button" onClick={onToggle} aria-label={collapsed ? "Fijar menú abierto" : "Compactar menú"} title={collapsed ? "Fijar menú abierto" : "Compactar menú"} className="absolute -right-3 top-[94px] hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_8px_18px_-10px_rgba(15,23,42,.5)] transition-colors hover:border-vase-green/40 hover:text-vase-green focus-visible:ring-2 focus-visible:ring-vase-green dark:border-slate-700 dark:bg-slate-900 lg:flex">{collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}</button>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={onCloseMobile} title={!expanded ? item.label : undefined} className={cn("group relative flex h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-medium outline-none transition-colors duration-150", active ? "text-vase-green" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100")}>
              {active && <motion.span layoutId="active-navigation" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 35 }} className="absolute inset-0 rounded-xl bg-vase-green-soft" />}
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} /></span>
              <motion.span animate={{ opacity: expanded || mobileOpen ? 1 : 0 }} className="relative truncate whitespace-nowrap">{item.label}</motion.span>
            </Link>;
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-200/80 p-3 dark:border-slate-800">
          <motion.div animate={{ opacity: expanded || mobileOpen ? 1 : 0 }} className="rounded-xl bg-slate-100 px-3 py-3 dark:bg-slate-900"><p className="text-xs font-semibold text-slate-900 dark:text-slate-100">WTA · Producción vidrio</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Homologación ARCA activa</p></motion.div>
        </div>
      </motion.div>
    </aside>
  </>;
}
