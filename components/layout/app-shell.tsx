"use client";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setCollapsed(localStorage.getItem("vase-sidebar-collapsed") === "true"); }, []);
  function toggleCollapsed() { setCollapsed((value) => { localStorage.setItem("vase-sidebar-collapsed", String(!value)); return !value; }); }
  return <div className="flex min-h-screen"><Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} onToggle={toggleCollapsed} /><div className="flex min-w-0 flex-1 flex-col"><Topbar onOpenMenu={() => setMobileOpen(true)} /><main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-8 lg:py-8"><PageTransition>{children}</PageTransition></main></div></div>;
}
