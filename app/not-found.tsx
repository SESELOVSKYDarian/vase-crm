import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-vase-green-soft text-vase-green-dark text-xl font-bold">
        404
      </div>
      <h1 className="text-lg font-bold">No encontramos esta página</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Revisá el enlace o volvé al dashboard para seguir trabajando.
      </p>
      <Link href="/dashboard" className="mt-2 rounded-lg bg-vase-green px-4 py-2 text-sm font-medium text-white hover:bg-vase-green-dark">
        Volver al dashboard
      </Link>
    </div>
  );
}
