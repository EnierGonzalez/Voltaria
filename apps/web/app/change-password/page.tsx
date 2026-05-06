import { changePasswordAction } from "@/lib/actions/auth-actions";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  await requireUser("/change-password");
  const params = await searchParams;
  const next = params.next ?? "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground premium-grid">
      <section className="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-2xl shadow-black/30">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan">Voltaria</p>
          <h1 className="mt-2 text-xl font-semibold text-foreground">Cambiar contraseña</h1>
          <p className="mt-2 text-sm text-muted">
            Define una contraseña segura para continuar.
          </p>
        </div>

        <form action={changePasswordAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <label htmlFor="currentPassword" className="text-sm font-medium text-muted">
              Contraseña actual
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className="h-11 w-full rounded-md border border-border bg-panel2 px-3 text-sm text-foreground outline-none transition focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm font-medium text-muted">
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              className="h-11 w-full rounded-md border border-border bg-panel2 px-3 text-sm text-foreground outline-none transition focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-muted">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="h-11 w-full rounded-md border border-border bg-panel2 px-3 text-sm text-foreground outline-none transition focus:border-primary"
            />
          </div>

          {params.error ? (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              Revisa la contraseña actual y usa mínimo 10 caracteres con mayúscula, minúscula y número.
            </p>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Guardar contraseña
          </button>
        </form>
      </section>
    </main>
  );
}
