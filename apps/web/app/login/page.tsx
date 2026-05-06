import { Zap } from "lucide-react";
import { loginAction } from "@/lib/actions/auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground premium-grid">
      <section className="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-2xl shadow-black/30">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/40 bg-primary/15 text-cyan">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan">Voltaria</p>
            <h1 className="text-xl font-semibold text-foreground">Acceso interno</h1>
          </div>
        </div>

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-muted">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-11 w-full rounded-md border border-border bg-panel2 px-3 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-primary"
              placeholder="admin@voltaria.local"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-muted">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-md border border-border bg-panel2 px-3 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-primary"
              placeholder="••••••••••"
            />
          </div>

          {params.error ? (
            <p className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              Credenciales inválidas.
            </p>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Iniciar sesión
          </button>
        </form>
      </section>
    </main>
  );
}
