import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import type { AppPermission, AppRole, PlatformRole } from "@voltaria/shared";
import {
  getPermissionsForPlatformRole,
  getPermissionsForRole
} from "@voltaria/shared";
import type { VoltariaDb } from "./client";
import {
  createSessionCookieOptions,
  generateSessionToken,
  getSessionExpiryDate,
  hashPassword,
  hashSessionToken,
  verifyPassword
} from "./auth-utils";
import {
  apartments,
  appUsers,
  properties,
  residents,
  userAuditEvents,
  userPropertyMemberships,
  userSessions
} from "./schema";

type DbExecutor = Pick<VoltariaDb, "insert" | "select" | "update" | "delete">;

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type AuthRequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

export type AuthResult =
  | {
      ok: true;
      user: CurrentUser;
      sessionToken?: string;
      expiresAt?: Date;
    }
  | {
      ok: false;
      error: string;
      reason:
        | "invalid_credentials"
        | "user_locked"
        | "user_inactive"
        | "no_active_membership"
        | "password_required"
        | "not_found"
        | "forbidden";
    };

export type CurrentUserMembership = {
  id: string;
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  role: AppRole;
  status: "active" | "invited" | "suspended" | "disabled";
  residentId: string | null;
  apartmentId: string | null;
  residentName: string | null;
  apartmentNumber: string | null;
};

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: "active" | "invited" | "suspended" | "disabled";
  userType: "staff" | "resident" | "service";
  platformRole: PlatformRole;
  mustChangePassword: boolean;
  memberships: CurrentUserMembership[];
  activeMembership: CurrentUserMembership | null;
  permissions: AppPermission[];
};

export type AppUserSummary = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: "active" | "invited" | "suspended" | "disabled";
  userType: "staff" | "resident" | "service";
  platformRole: PlatformRole;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  disabledAt: string | null;
  membershipId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  role: AppRole | null;
  membershipStatus: "active" | "invited" | "suspended" | "disabled" | null;
  residentId: string | null;
  residentName: string | null;
  apartmentId: string | null;
  apartmentNumber: string | null;
};

export async function createUser(
  db: VoltariaDb,
  input: {
    email: string;
    fullName: string;
    userType: "staff" | "resident" | "service";
    status?: "active" | "invited" | "suspended" | "disabled";
    phone?: string;
    platformRole?: PlatformRole;
    password?: string;
    mustChangePassword?: boolean;
    metadata?: Record<string, unknown>;
  }
) {
  const email = normalizeEmail(input.email);
  const existing = await getUserByEmail(db, email);

  if (existing) {
    throw new Error("Ya existe un usuario con ese correo.");
  }

  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const [user] = await db
    .insert(appUsers)
    .values({
      email,
      fullName: input.fullName.trim(),
      userType: input.userType,
      status: input.status ?? "active",
      platformRole: input.platformRole ?? "none",
      phone: input.phone?.trim() || null,
      passwordHash,
      mustChangePassword: input.mustChangePassword ?? true,
      metadata: input.metadata ?? {}
    })
    .returning();

  if (!user) {
    throw new Error("No se pudo crear el usuario.");
  }

  await recordUserAuditEvent(db, {
    userId: user.id,
    targetUserId: user.id,
    action: "user.created",
    metadata: { userType: user.userType, status: user.status }
  });

  return user;
}

export async function createInitialOwnerIfMissing(db: VoltariaDb) {
  const [property] = await db.select().from(properties).orderBy(properties.createdAt).limit(1);

  if (!property) {
    return null;
  }

  const [existingOwner] = await db
    .select({ id: userPropertyMemberships.id })
    .from(userPropertyMemberships)
    .where(
      and(
        eq(userPropertyMemberships.propertyId, property.id),
        eq(userPropertyMemberships.role, "owner"),
        eq(userPropertyMemberships.status, "active")
      )
    )
    .limit(1);

  if (existingOwner) {
    return existingOwner;
  }

  const email = normalizeEmail(process.env.FIRST_OWNER_EMAIL ?? "admin@voltaria.local");
  const password = process.env.FIRST_OWNER_PASSWORD?.trim();
  const appEnv = process.env.APP_ENV ?? "development";
  const effectivePassword = password || (appEnv === "development" ? "VoltariaDev2026!" : undefined);
  const user =
    (await getUserByEmail(db, email)) ??
    (await createUser(db, {
      email,
      fullName: process.env.FIRST_OWNER_NAME?.trim() || "Voltaria Owner",
      userType: "staff",
      status: "active",
      ...(effectivePassword ? { password: effectivePassword } : {}),
      mustChangePassword: true,
      metadata: { seed: true, initialOwner: true }
    }));

  return createMembership(db, {
    userId: user.id,
    propertyId: property.id,
    role: "owner",
    status: "active"
  });
}

export async function authenticateUser(
  db: VoltariaDb,
  emailInput: string,
  password: string,
  requestMeta: AuthRequestMeta = {}
): Promise<AuthResult> {
  const email = normalizeEmail(emailInput);
  const user = await getUserByEmail(db, email);
  const genericFailure: AuthResult = {
    ok: false,
    error: "Credenciales inválidas.",
    reason: "invalid_credentials"
  };

  if (!user) {
    await recordUserAuditEvent(db, {
      action: "user.login_failed",
      metadata: { reason: "unknown_user", email }
    });
    return genericFailure;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordUserAuditEvent(db, {
      userId: user.id,
      action: "user.login_failed",
      reason: "locked",
      metadata: scrubRequestMeta(requestMeta)
    });
    return { ok: false, error: "Credenciales inválidas.", reason: "user_locked" };
  }

  if (user.status !== "active") {
    await recordUserAuditEvent(db, {
      userId: user.id,
      action: "user.login_failed",
      reason: "inactive",
      metadata: scrubRequestMeta(requestMeta)
    });
    return genericFailure;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    await registerFailedLogin(db, user.id, user.failedLoginAttempts, requestMeta);
    return genericFailure;
  }

  const currentUser = await buildCurrentUser(db, user.id);

  if (
    !currentUser ||
    (currentUser.memberships.length === 0 && currentUser.platformRole === "none")
  ) {
    await recordUserAuditEvent(db, {
      userId: user.id,
      action: "user.login_failed",
      reason: "no_active_membership",
      metadata: scrubRequestMeta(requestMeta)
    });
    return {
      ok: false,
      error: "Credenciales inválidas.",
      reason: "no_active_membership"
    };
  }

  await db
    .update(appUsers)
    .set({
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date()
    })
    .where(eq(appUsers.id, user.id));

  await recordUserAuditEvent(db, {
    userId: user.id,
    action: "user.login_success",
    ...(currentUser.activeMembership?.propertyId
      ? { propertyId: currentUser.activeMembership.propertyId }
      : {}),
    metadata: scrubRequestMeta(requestMeta)
  });

  return { ok: true, user: currentUser };
}

export async function createUserSession(
  db: VoltariaDb,
  userId: string,
  requestMeta: AuthRequestMeta = {}
) {
  const token = generateSessionToken();
  const expiresAt = getSessionExpiryDate();

  const [session] = await db
    .insert(userSessions)
    .values({
      userId,
      sessionTokenHash: hashSessionToken(token),
      expiresAt,
      ...(requestMeta.ipAddress ? { ipAddress: requestMeta.ipAddress } : {}),
      ...(requestMeta.userAgent ? { userAgent: requestMeta.userAgent } : {})
    })
    .returning();

  if (!session) {
    throw new Error("No se pudo crear la sesión.");
  }

  return {
    session,
    token,
    expiresAt,
    cookieOptions: createSessionCookieOptions()
  };
}

export async function getSessionFromToken(db: VoltariaDb, token: string) {
  const [session] = await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.sessionTokenHash, hashSessionToken(token)),
        gt(userSessions.expiresAt, new Date()),
        isNull(userSessions.revokedAt)
      )
    )
    .limit(1);

  if (!session) {
    return null;
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);

  if (session.lastSeenAt < fiveMinutesAgo) {
    await db
      .update(userSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(userSessions.id, session.id));
  }

  return session;
}

export async function getCurrentUserFromSession(db: VoltariaDb, token: string) {
  const session = await getSessionFromToken(db, token);

  if (!session) {
    return null;
  }

  return buildCurrentUser(db, session.userId);
}

export async function logoutSession(db: VoltariaDb, token: string) {
  const tokenHash = hashSessionToken(token);
  const [session] = await db
    .update(userSessions)
    .set({ revokedAt: new Date(), lastSeenAt: new Date() })
    .where(eq(userSessions.sessionTokenHash, tokenHash))
    .returning();

  if (session) {
    await recordUserAuditEvent(db, {
      userId: session.userId,
      action: "user.logout"
    });
  }
}

export async function changePassword(
  db: VoltariaDb,
  userId: string,
  currentPassword: string | undefined,
  newPassword: string
) {
  const [user] = await db.select().from(appUsers).where(eq(appUsers.id, userId)).limit(1);

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  if (!user.mustChangePassword) {
    const validCurrentPassword = await verifyPassword(currentPassword ?? "", user.passwordHash);

    if (!validCurrentPassword) {
      throw new Error("La contraseña actual no es correcta.");
    }
  }

  await db
    .update(appUsers)
    .set({
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date()
    })
    .where(eq(appUsers.id, userId));

  await recordUserAuditEvent(db, {
    userId,
    targetUserId: userId,
    action: "user.password_changed"
  });
}

export async function adminSetTemporaryPassword(
  db: VoltariaDb,
  targetUserId: string,
  temporaryPassword: string,
  performedBy?: string
) {
  await db
    .update(appUsers)
    .set({
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date()
    })
    .where(eq(appUsers.id, targetUserId));

  await db
    .update(userSessions)
    .set({ revokedAt: new Date(), lastSeenAt: new Date() })
    .where(and(eq(userSessions.userId, targetUserId), isNull(userSessions.revokedAt)));

  await recordUserAuditEvent(db, {
    targetUserId,
    action: "user.password_changed",
    reason: "temporary_password_set",
    ...(performedBy ? { userId: performedBy } : {})
  });
}

export async function updateUserStatus(
  db: VoltariaDb,
  userId: string,
  status: "active" | "invited" | "suspended" | "disabled",
  reason?: string,
  performedBy?: string,
  allowOwnerStatusChanges = false
) {
  if (status !== "active") {
    await assertCanChangeOwnerUserStatus(db, userId, allowOwnerStatusChanges);
    await assertUserIsNotLastOwner(db, userId);
  }

  await db
    .update(appUsers)
    .set({
      status,
      disabledAt: status === "disabled" ? new Date() : null,
      updatedAt: new Date()
    })
    .where(eq(appUsers.id, userId));

  if (status !== "active") {
    await db
      .update(userSessions)
      .set({ revokedAt: new Date(), lastSeenAt: new Date() })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
  }

  await recordUserAuditEvent(db, {
    targetUserId: userId,
    action: `user.${status}`,
    ...(reason ? { reason } : {}),
    ...(performedBy ? { userId: performedBy } : {})
  });
}

export async function createMembership(
  db: VoltariaDb,
  input: {
    userId: string;
    propertyId: string;
    role: AppRole;
    status?: "active" | "invited" | "suspended" | "disabled";
    residentId?: string;
    apartmentId?: string;
    performedBy?: string;
  }
) {
  const [existing] = await db
    .select()
    .from(userPropertyMemberships)
    .where(
      and(
        eq(userPropertyMemberships.userId, input.userId),
        eq(userPropertyMemberships.propertyId, input.propertyId)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(userPropertyMemberships)
      .set({
        role: input.role,
        status: input.status ?? "active",
        residentId: input.residentId ?? null,
        apartmentId: input.apartmentId ?? null,
        updatedAt: new Date()
      })
      .where(eq(userPropertyMemberships.id, existing.id))
      .returning();

    await recordUserAuditEvent(db, {
      propertyId: input.propertyId,
      targetUserId: input.userId,
      action: "user.membership_updated",
      ...(input.performedBy ? { userId: input.performedBy } : {}),
      metadata: { role: input.role, status: input.status ?? "active" }
    });

    return updated ?? existing;
  }

  const [membership] = await db
    .insert(userPropertyMemberships)
    .values({
      userId: input.userId,
      propertyId: input.propertyId,
      role: input.role,
      status: input.status ?? "active",
      residentId: input.residentId,
      apartmentId: input.apartmentId
    })
    .returning();

  if (!membership) {
    throw new Error("No se pudo crear la membresía.");
  }

  await recordUserAuditEvent(db, {
    propertyId: input.propertyId,
    targetUserId: input.userId,
    action: "user.membership_created",
    ...(input.performedBy ? { userId: input.performedBy } : {}),
    metadata: { role: input.role, status: input.status ?? "active" }
  });

  return membership;
}

export async function updateMembershipRole(
  db: VoltariaDb,
  input: {
    membershipId: string;
    role: AppRole;
    performedBy?: string;
    allowOwnerRoleChanges?: boolean;
  }
) {
  const [membership] = await db
    .select()
    .from(userPropertyMemberships)
    .where(eq(userPropertyMemberships.id, input.membershipId))
    .limit(1);

  if (!membership) {
    throw new Error("Membresía no encontrada.");
  }

  if ((membership.role === "owner" || input.role === "owner") && !input.allowOwnerRoleChanges) {
    throw new Error("Solo owner puede modificar membresías owner.");
  }

  if (membership.role === "owner" && input.role !== "owner") {
    await assertMembershipIsNotLastOwner(db, membership.id);
  }

  const [updated] = await db
    .update(userPropertyMemberships)
    .set({ role: input.role, updatedAt: new Date() })
    .where(eq(userPropertyMemberships.id, membership.id))
    .returning();

  await recordUserAuditEvent(db, {
    propertyId: membership.propertyId,
    targetUserId: membership.userId,
    action: "user.role_changed",
    ...(input.performedBy ? { userId: input.performedBy } : {}),
    metadata: { from: membership.role, to: input.role }
  });

  return updated ?? membership;
}

export async function getUserPermissions(db: VoltariaDb, userId: string, propertyId: string) {
  const [membership] = await db
    .select({ role: userPropertyMemberships.role, status: userPropertyMemberships.status })
    .from(userPropertyMemberships)
    .where(
      and(
        eq(userPropertyMemberships.userId, userId),
        eq(userPropertyMemberships.propertyId, propertyId),
        eq(userPropertyMemberships.status, "active")
      )
    )
    .limit(1);

  if (!membership) {
    return [];
  }

  return getPermissionsForRole(membership.role);
}

export async function requirePermission(
  db: VoltariaDb,
  userId: string,
  propertyId: string,
  permission: AppPermission
) {
  const permissions = await getUserPermissions(db, userId, propertyId);

  if (!permissions.includes(permission)) {
    throw new Error("No tienes permiso para esta acción.");
  }
}

export async function listAppUsers(db: VoltariaDb, propertyId: string): Promise<AppUserSummary[]> {
  const rows = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      fullName: appUsers.fullName,
      phone: appUsers.phone,
      status: appUsers.status,
      userType: appUsers.userType,
      platformRole: appUsers.platformRole,
      mustChangePassword: appUsers.mustChangePassword,
      lastLoginAt: appUsers.lastLoginAt,
      disabledAt: appUsers.disabledAt,
      membershipId: userPropertyMemberships.id,
      propertyId: userPropertyMemberships.propertyId,
      propertyName: properties.name,
      role: userPropertyMemberships.role,
      membershipStatus: userPropertyMemberships.status,
      residentId: userPropertyMemberships.residentId,
      residentName: residents.fullName,
      apartmentId: userPropertyMemberships.apartmentId,
      apartmentNumber: apartments.number
    })
    .from(appUsers)
    .leftJoin(
      userPropertyMemberships,
      and(
        eq(userPropertyMemberships.userId, appUsers.id),
        eq(userPropertyMemberships.propertyId, propertyId)
      )
    )
    .leftJoin(properties, eq(properties.id, userPropertyMemberships.propertyId))
    .leftJoin(residents, eq(residents.id, userPropertyMemberships.residentId))
    .leftJoin(apartments, eq(apartments.id, userPropertyMemberships.apartmentId))
    .orderBy(desc(appUsers.createdAt));

  return rows.map((row) => ({
    ...row,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    disabledAt: row.disabledAt?.toISOString() ?? null
  }));
}

export async function getUserByEmail(db: DbExecutor, emailInput: string) {
  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, normalizeEmail(emailInput)))
    .limit(1);

  return user ?? null;
}

export async function recordUserAuditEvent(
  db: DbExecutor,
  input: {
    propertyId?: string;
    userId?: string;
    targetUserId?: string;
    action: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await db.insert(userAuditEvents).values({
    propertyId: input.propertyId ?? null,
    userId: input.userId ?? null,
    targetUserId: input.targetUserId ?? null,
    action: input.action,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {}
  });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function buildCurrentUser(db: VoltariaDb, userId: string): Promise<CurrentUser | null> {
  const [user] = await db.select().from(appUsers).where(eq(appUsers.id, userId)).limit(1);

  if (!user || user.status !== "active") {
    return null;
  }

  const memberships = await db
    .select({
      id: userPropertyMemberships.id,
      propertyId: userPropertyMemberships.propertyId,
      propertyName: properties.name,
      propertySlug: properties.slug,
      role: userPropertyMemberships.role,
      status: userPropertyMemberships.status,
      residentId: userPropertyMemberships.residentId,
      apartmentId: userPropertyMemberships.apartmentId,
      residentName: residents.fullName,
      apartmentNumber: apartments.number
    })
    .from(userPropertyMemberships)
    .innerJoin(properties, eq(properties.id, userPropertyMemberships.propertyId))
    .leftJoin(residents, eq(residents.id, userPropertyMemberships.residentId))
    .leftJoin(apartments, eq(apartments.id, userPropertyMemberships.apartmentId))
    .where(
      and(eq(userPropertyMemberships.userId, user.id), eq(userPropertyMemberships.status, "active"))
    )
    .orderBy(userPropertyMemberships.createdAt);

  const activeMembership = memberships[0] ?? null;
  const permissionSet = new Set<AppPermission>([
    ...getPermissionsForPlatformRole(user.platformRole),
    ...(activeMembership ? getPermissionsForRole(activeMembership.role) : [])
  ]);
  const permissions = [...permissionSet];

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    status: user.status,
    userType: user.userType,
    platformRole: user.platformRole,
    mustChangePassword: user.mustChangePassword,
    memberships,
    activeMembership,
    permissions
  };
}

async function registerFailedLogin(
  db: VoltariaDb,
  userId: string,
  currentAttempts: number,
  requestMeta: AuthRequestMeta
) {
  const failedLoginAttempts = currentAttempts + 1;
  const lockedUntil =
    failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60_000)
      : null;

  await db
    .update(appUsers)
    .set({
      failedLoginAttempts,
      lockedUntil,
      updatedAt: new Date()
    })
    .where(eq(appUsers.id, userId));

  await recordUserAuditEvent(db, {
    userId,
    action: "user.login_failed",
    reason: lockedUntil ? "locked" : "invalid_credentials",
    metadata: scrubRequestMeta(requestMeta)
  });
}

async function assertUserIsNotLastOwner(db: VoltariaDb, userId: string) {
  const memberships = await db
    .select()
    .from(userPropertyMemberships)
    .where(and(eq(userPropertyMemberships.userId, userId), eq(userPropertyMemberships.role, "owner")));

  for (const membership of memberships) {
    await assertMembershipIsNotLastOwner(db, membership.id);
  }
}

async function assertCanChangeOwnerUserStatus(
  db: VoltariaDb,
  userId: string,
  allowOwnerStatusChanges: boolean
) {
  if (allowOwnerStatusChanges) {
    return;
  }

  const [membership] = await db
    .select({ id: userPropertyMemberships.id })
    .from(userPropertyMemberships)
    .where(and(eq(userPropertyMemberships.userId, userId), eq(userPropertyMemberships.role, "owner")))
    .limit(1);

  if (membership) {
    throw new Error("Solo owner puede suspender o deshabilitar otro owner.");
  }
}

async function assertMembershipIsNotLastOwner(db: VoltariaDb, membershipId: string) {
  const [membership] = await db
    .select()
    .from(userPropertyMemberships)
    .where(eq(userPropertyMemberships.id, membershipId))
    .limit(1);

  if (!membership || membership.role !== "owner") {
    return;
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userPropertyMemberships)
    .innerJoin(appUsers, eq(appUsers.id, userPropertyMemberships.userId))
    .where(
      and(
        eq(userPropertyMemberships.propertyId, membership.propertyId),
        eq(userPropertyMemberships.role, "owner"),
        eq(userPropertyMemberships.status, "active"),
        eq(appUsers.status, "active"),
        ne(userPropertyMemberships.id, membership.id)
      )
    );

  if ((result?.count ?? 0) < 1) {
    throw new Error("No se puede dejar la propiedad sin un owner activo.");
  }
}

function scrubRequestMeta(meta: AuthRequestMeta) {
  return {
    ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
    ...(meta.userAgent ? { userAgent: meta.userAgent.slice(0, 220) } : {})
  };
}

export function canUser(user: CurrentUser, permission: AppPermission) {
  return user.permissions.includes(permission);
}
