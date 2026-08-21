"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setLoading(true); setError(""); try { const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); const text = await res.text(); let data: { error?: string } = {}; try { data = text ? JSON.parse(text) : {}; } catch {} if (!res.ok) setError(data.error ?? "No se pudo iniciar sesión. Verificá la conexión con el servidor."); else router.push("/dashboard"); } catch { setError("No se pudo conectar con el servidor."); } finally { setLoading(false); } }
  return <main className="flex min-h-screen items-center justify-center bg-background p-4"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 shadow-vase-lg"><div><p className="text-sm font-bold text-vase-green">VASE CRM</p><h1 className="mt-2 text-2xl font-bold">Iniciar sesión</h1><p className="mt-1 text-sm text-muted-foreground">Ingresá para continuar.</p></div><div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><div><Label htmlFor="password">Contraseña</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button className="w-full" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</Button></form></main>;
}
