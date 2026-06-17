import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground premium-grid">
      <section className="w-full max-w-md rounded-lg border border-border bg-panel p-6 text-center shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.24em] text-warning">Acceso denegado</p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">No tienes permiso</h1>
        <p className="mt-3 text-sm text-muted">
          Tu usuario no tiene permisos para abrir esta sección o ejecutar esta acción.
        </p>
        <Link
          href="/select-property"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          Volver al dashboard
        </Link>
      </section>
    </main>
  );
}
