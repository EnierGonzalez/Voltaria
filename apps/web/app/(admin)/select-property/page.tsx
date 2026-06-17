import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ServerCog } from "lucide-react";
import { SectionCard, StatusBadge } from "@voltaria/ui";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SelectPropertyPage() {
  const user = await requireUser("/select-property");
  const memberships = user.memberships.filter((membership) => membership.status === "active");

  if (user.platformRole === "none" && memberships.length === 1 && memberships[0]) {
    redirect(membershipHref(memberships[0]));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Selecciona propiedad</h1>
        <p className="mt-1 text-sm text-muted">
          Entra al panel tenant de una propiedad específica. Platform Admin queda separado.
        </p>
      </div>

      {user.permissions.includes("platform.tenants.view") ? (
        <Link
          href="/platform"
          className="flex min-w-0 items-center gap-3 rounded-lg border border-cyan/30 bg-cyan/10 p-4 text-cyan transition hover:bg-cyan/15"
        >
          <ServerCog className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">Ir a Platform Admin</p>
            <p className="truncate text-sm text-muted">Scope global SaaS, tenants y gateways.</p>
          </div>
        </Link>
      ) : null}

      <SectionCard title="Propiedades disponibles" description={`${memberships.length} membresías activas`}>
        {memberships.length === 0 ? (
          <div className="rounded-lg border border-border bg-panel2/60 p-4 text-sm text-muted">
            No tienes propiedades asignadas. Contacta al administrador para revisar tu acceso.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {memberships.map((membership) => (
              <Link
                key={membership.id}
                href={membershipHref(membership)}
                className="min-w-0 rounded-lg border border-border bg-panel2/60 p-4 transition hover:border-primary/60 hover:bg-panel2"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-cyan" aria-hidden="true" />
                      <p className="truncate font-semibold text-foreground">{membership.propertyName}</p>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {membership.organizationName ?? "Sin organización"} · {membership.propertySlug}
                    </p>
                  </div>
                  <StatusBadge variant="info">{membership.role}</StatusBadge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function membershipHref(membership: Awaited<ReturnType<typeof requireUser>>["memberships"][number]) {
  return membership.organizationSlug
    ? `/app/${membership.organizationSlug}/${membership.propertySlug}/dashboard`
    : `/app/${membership.propertySlug}/dashboard`;
}
