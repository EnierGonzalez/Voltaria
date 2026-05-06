import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createDbClient,
  createDbClientIfConfigured,
  getCurrentUserFromSession as dbGetCurrentUserFromSession,
  loadDatabaseEnv,
  SESSION_COOKIE_NAME,
  type CurrentUser
} from "@voltaria/db";
import type { AppPermission } from "@voltaria/shared";

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
  return (process.env.APP_ENV ?? "development") === "development";
}
