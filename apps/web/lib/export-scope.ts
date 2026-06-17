import {
  getPropertySummary,
  getTenantPropertyContextBySlugs,
  type CurrentUser,
  type VoltariaDb
} from "@voltaria/db";
import { recordIdSchema } from "@voltaria/shared";

type ExportScopeResult =
  | {
      ok: true;
      propertyId: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function resolveTenantExportScope(
  db: VoltariaDb,
  user: CurrentUser,
  requestUrl: string
): Promise<ExportScopeResult> {
  const searchParams = new URL(requestUrl).searchParams;
  const organizationSlug = searchParams.get("organizationSlug");
  const propertySlug = searchParams.get("propertySlug");
  const propertyId = searchParams.get("propertyId");

  if (organizationSlug && propertySlug) {
    const tenant = await getTenantPropertyContextBySlugs(db, organizationSlug, propertySlug);

    if (!tenant) {
      return { ok: false, status: 404, error: "Tenant no encontrado." };
    }

    if (!canAccessProperty(user, tenant.property.id)) {
      return { ok: false, status: 403, error: "No tienes acceso a esta propiedad." };
    }

    return { ok: true, propertyId: tenant.property.id };
  }

  if (propertyId) {
    const parsed = recordIdSchema.safeParse(propertyId);

    if (!parsed.success) {
      return { ok: false, status: 400, error: "Propiedad inválida." };
    }

    if (!canAccessProperty(user, parsed.data)) {
      return { ok: false, status: 403, error: "No tienes acceso a esta propiedad." };
    }

    const property = await getPropertySummary(db, parsed.data);

    if (!property) {
      return { ok: false, status: 404, error: "Propiedad no encontrada." };
    }

    return { ok: true, propertyId: parsed.data };
  }

  const activeMemberships = user.memberships.filter((membership) => membership.status === "active");

  if (activeMemberships.length === 1 && activeMemberships[0]) {
    return { ok: true, propertyId: activeMemberships[0].propertyId };
  }

  return {
    ok: false,
    status: 400,
    error: "Indica organizationSlug y propertySlug para exportar sin ambigüedad."
  };
}

export function canAccessProperty(user: CurrentUser, propertyId: string) {
  const hasTenantAccess = user.memberships.some(
    (membership) => membership.status === "active" && membership.propertyId === propertyId
  );
  const hasPlatformAccess =
    user.permissions.includes("platform.impersonate_property") &&
    user.permissions.includes("platform.tenants.view");

  return hasTenantAccess || hasPlatformAccess;
}
