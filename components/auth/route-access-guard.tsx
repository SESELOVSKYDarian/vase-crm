"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const protectedRoutes: Array<[string, string | string[]]> = [
  ["/clientes", "clients.view"], ["/presupuestos", "quotes.view"], ["/produccion", ["production.view_all", "production.view_assigned"]],
  ["/entregas", "deliveries.view"], ["/remitos", "remitos.view"], ["/facturacion", "invoices.view"], ["/cobros", "payments.view"],
  ["/cuenta-corriente", "account.view"], ["/analiticas", "analytics.view"], ["/precios", "prices.view"], ["/configuracion", "company.settings.manage"],
];

export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const [checked, setChecked] = useState(false);
  const requirement = useMemo(() => protectedRoutes.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1], [pathname]);
  useEffect(() => { let active = true; if (!requirement) { setChecked(true); return; } setChecked(false); fetch("/api/auth/me").then((response) => response.ok ? response.json() : null).then((payload) => { const permissions: string[] = payload?.user?.permissions ?? []; const allowed = Array.isArray(requirement) ? requirement.some((permission) => permissions.includes(permission)) : permissions.includes(requirement); if (!allowed) router.replace("/dashboard?access=denied"); if (active) setChecked(true); }).catch(() => { if (active) setChecked(true); }); return () => { active = false; }; }, [requirement, router]);
  if (requirement && !checked) return <div className="min-h-[45dvh]" aria-busy="true" />;
  return <>{children}</>;
}
