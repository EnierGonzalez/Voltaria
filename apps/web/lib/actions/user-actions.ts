"use server";

import { revalidatePath } from "next/cache";
import {
  adminSetTemporaryPassword,
  createMembership,
  createUser,
  createDbClient,
  getUserByEmail,
  loadDatabaseEnv,
  updateMembershipRole,
  updateUserStatus
} from "@voltaria/db";
import {
  userCreateSchema,
  userRoleUpdateSchema,
  userStatusUpdateSchema,
  userTemporaryPasswordSchema
} from "@voltaria/shared";
import { requireActionPermission } from "@/lib/auth";

loadDatabaseEnv();

type UserActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function createUserAction(input: unknown): Promise<UserActionResult> {
  const actor = await requireActionPermission("users.manage");
  const parsed = userCreateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Datos de usuario inválidos." };
  }

  if (parsed.data.role === "owner" && !actor.permissions.includes("users.manage_roles")) {
    return { ok: false, error: "Solo owner puede crear otro owner." };
  }

  return withUserDbAction(async (db) => {
    const existingUser = await getUserByEmail(db, parsed.data.email);
    const user =
      existingUser ??
      (await createUser(db, {
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        userType: parsed.data.userType,
        status: parsed.data.status,
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
        password: parsed.data.temporaryPassword,
        mustChangePassword: true,
        metadata: { createdFrom: "settings.users" }
      }));

    await createMembership(db, {
      userId: user.id,
      propertyId: parsed.data.propertyId,
      role: parsed.data.role,
      status: "active",
      ...(parsed.data.residentId ? { residentId: parsed.data.residentId } : {}),
      ...(parsed.data.apartmentId ? { apartmentId: parsed.data.apartmentId } : {}),
      performedBy: actor.id
    });

    revalidateUsers();
    return { ok: true, message: "Usuario creado." };
  });
}

export async function updateUserStatusAction(input: unknown): Promise<UserActionResult> {
  const actor = await requireActionPermission("users.manage");
  const parsed = userStatusUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Estado inválido." };
  }

  return withUserDbAction(async (db) => {
    await updateUserStatus(
      db,
      parsed.data.userId,
      parsed.data.status,
      parsed.data.reason,
      actor.id,
      actor.permissions.includes("users.manage_roles")
    );
    revalidateUsers();
    return { ok: true, message: "Estado actualizado." };
  });
}

export async function updateUserRoleAction(input: unknown): Promise<UserActionResult> {
  const actor = await requireActionPermission("users.manage");
  const parsed = userRoleUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Rol inválido." };
  }

  if (parsed.data.role === "owner" && !actor.permissions.includes("users.manage_roles")) {
    return { ok: false, error: "Solo owner puede asignar rol owner." };
  }

  return withUserDbAction(async (db) => {
    await updateMembershipRole(db, {
      membershipId: parsed.data.membershipId,
      role: parsed.data.role,
      performedBy: actor.id,
      allowOwnerRoleChanges: actor.permissions.includes("users.manage_roles")
    });
    revalidateUsers();
    return { ok: true, message: "Rol actualizado." };
  });
}

export async function resetTemporaryPasswordAction(input: unknown): Promise<UserActionResult> {
  const actor = await requireActionPermission("users.manage");
  const parsed = userTemporaryPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Contraseña temporal inválida." };
  }

  return withUserDbAction(async (db) => {
    await adminSetTemporaryPassword(db, parsed.data.userId, parsed.data.temporaryPassword, actor.id);
    revalidateUsers();
    return { ok: true, message: "Contraseña temporal actualizada." };
  });
}

async function withUserDbAction(
  load: (db: ReturnType<typeof createDbClient>["db"]) => Promise<UserActionResult>
): Promise<UserActionResult> {
  let context: ReturnType<typeof createDbClient> | null = null;

  try {
    context = createDbClient();
    return await load(context.db);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar usuarios."
    };
  } finally {
    await context?.client.end();
  }
}

function revalidateUsers() {
  revalidatePath("/settings");
  revalidatePath("/settings/users");
}
