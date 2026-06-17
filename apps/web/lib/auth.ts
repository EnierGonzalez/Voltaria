import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  createDbClient,
  createDbClientIfConfigured,
  getCurrentUserFromSession as dbGetCurrentUserFromSession,
  getTenantPropertyContextsByPropertySlug,
  getTenantPropertyContextBySlugs,
  loadDatabaseEnv,
  SESSION_COOKIE_NAME,
  type CurrentUser,
  type CurrentUserMembership,
  type TenantPropertyContext
} from "@voltaria/db";
import {
  getPermissionsForRole,
  isDevelopmentDemoTenantFallbackAllowed,
  type AppPermission
} from "@voltaria/shared";

loadDatabaseEnv();

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await getSessionCookieValue();

  if (!token) {
    return null;
  }

  const context = createDbClientIfConfigured();

  if (!context) {
    return null;
  }

  try {
    return await dbGetCurrentUserFromSession(context.db, token);
  } catch {
    return null;
  } finally {
    await context.client.end();
  }
});

export async function requireUser(next = "/dashboard") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return user;
}

export async function requirePagePermission(permission: AppPermission, next = "/dashboard") {
  const user = await requireUser(next);

  if (!user.permissions.includes(permission)) {
    redirect("/403");
  }

  return user;
}

export async function requireAnyPagePermission(permissions: AppPermission[], next = "/dashboard") {
  const user = await requireUser(next);

  if (!permissions.some((permission) => user.permissions.includes(permission))) {
    redirect("/403");
  }

  return user;
}

export async function requireActionPermission(permission: AppPermission) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Debes iniciar sesión.");
  }

  if (!user.permissions.includes(permission)) {
    throw new Error("No tienes permiso para esta acción.");
  }

  return user;
}

export type TenantContext = TenantPropertyContext & {
  user: CurrentUser;
  membership: CurrentUserMembership | null;
  permissions: AppPermission[];
  basePath: string;
  isPlatformSupportMode: boolean;
};

export async function getTenantContextFromParams(
  params:
    | { organizationSlug: string; propertySlug: string }
    | Promise<{ organizationSlug: string; propertySlug: string }>,
  permission?: AppPermission
) {
  const { organizationSlug, propertySlug } = await params;
  return requireTenantMembership(
    organizationSlug,
    propertySlug,
    permission,
    `/app/${organizationSlug}/${propertySlug}/dashboard`
  );
}

export async function requireTenantMembership(
  organizationSlug: string,
  propertySlug: string,
  permission?: AppPermission,
  next = `/app/${organizationSlug}/${propertySlug}/dashboard`
): Promise<TenantContext> {
  const user = await requireUser(next);
  const tenant = await withDbContext(({ db }) =>
    getTenantPropertyContextBySlugs(db, organizationSlug, propertySlug)
  );

  if (!tenant) {
    notFound();
  }

  const membership =
    user.memberships.find((item) => item.propertyId === tenant.property.id) ?? null;
  const canSupportTenant =
    !membership &&
    user.permissions.includes("platform.impersonate_property") &&
    user.permissions.includes("platform.tenants.view");

  if (!membership && !canSupportTenant) {
    redirect("/403");
  }

  const permissions = membership ? getPermissionsForRole(membership.role) : user.permissions;

  if (permission && !permissions.includes(permission)) {
    redirect("/403");
  }

  return {
    ...tenant,
    user,
    membership,
    permissions,
    basePath: `/app/${tenant.organization?.slug ?? organizationSlug}/${tenant.property.slug}`,
    isPlatformSupportMode: canSupportTenant
  };
}

export async function getPlatformContext(permission: AppPermission = "platform.tenants.view") {
  const user = await requireUser("/platform");

  if (!user.permissions.includes(permission)) {
    redirect("/403");
  }

  return { user };
}

export function getDefaultAuthenticatedPath(user: CurrentUser) {
  const activeMemberships = user.memberships.filter((membership) => membership.status === "active");

  if (user.userType === "resident" && activeMemberships.some((membership) => membership.residentId)) {
    return "/mobile/home";
  }

  if (user.platformRole !== "none" && user.permissions.includes("platform.tenants.view")) {
    return "/platform";
  }

  const onlyMembership = activeMemberships[0];

  if (onlyMembership && activeMemberships.length === 1) {
    return `${membershipBasePath(onlyMembership)}/dashboard`;
  }

  if (activeMemberships.length > 1) {
    return "/select-property";
  }

  return "/403";
}

export async function redirectLegacyTenantRoute(section: string) {
  const user = await requireUser(`/${section}`);
  const activeMemberships = user.memberships.filter((membership) => membership.status === "active");

  const onlyMembership = activeMemberships[0];

  if (onlyMembership && activeMemberships.length === 1) {
    redirect(`${membershipBasePath(onlyMembership)}/${section}`);
  }

  if (activeMemberships.length > 1) {
    redirect("/select-property");
  }

  if (user.platformRole !== "none" && user.permissions.includes("platform.tenants.view")) {
    redirect("/platform");
  }

  redirect("/403");
}

export async function redirectLegacyAppPropertyRoute(propertySlug: string, section = "dashboard") {
  await requireUser(`/app/${propertySlug}/${section}`);
  const tenants = await withDbContext(({ db }) => getTenantPropertyContextsByPropertySlug(db, propertySlug));

  if (tenants.length === 0) {
    notFound();
  }

  if (tenants.length > 1) {
    redirect("/select-property");
  }

  const tenant = tenants[0];

  if (!tenant) {
    notFound();
  }

  if (!tenant.organization) {
    redirect("/select-property");
  }

  redirect(`/app/${tenant.organization.slug}/${tenant.property.slug}/${section}`);
}

export async function getCurrentResidentContext() {
  const user = await getCurrentUser();
  const membership = user?.activeMembership;

  if (!user || !membership?.residentId) {
    return null;
  }

  return {
    user,
    propertyId: membership.propertyId,
    residentId: membership.residentId,
    apartmentId: membership.apartmentId
  };
}

export async function getSessionCookieValue() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getActionRequestMeta() {
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    undefined;
  const userAgent = headerStore.get("user-agent") ?? undefined;

  return {
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {})
  };
}

export async function withDbContext<T>(
  load: (context: ReturnType<typeof createDbClient>) => Promise<T>
) {
  const context = createDbClient();

  try {
    return await load(context);
  } finally {
    await context.client.end();
  }
}

export function isDevelopmentAuthFallbackAllowed() {
  return isDevelopmentDemoTenantFallbackAllowed();
}

function membershipBasePath(membership: CurrentUserMembership) {
  return membership.organizationSlug
    ? `/app/${membership.organizationSlug}/${membership.propertySlug}`
    : `/app/${membership.propertySlug}`;
}
