"use server";

import { revalidatePath } from "next/cache";
import {
  approveBillingCycle,
  closeBillingCycle,
  createBillingCycleDraft,
  createDbClient,
  excludeSessionFromCycle,
  includeSessionInCycle,
  loadDatabaseEnv,
  recalculateBillingCycle,
  updateBillingCycleItemAdjustment,
  type CurrentUser
} from "@voltaria/db";
import {
  billingCycleCreateSchema,
  billingCycleIdSchema,
  billingCycleItemAdjustmentSchema,
  recordIdSchema
} from "@voltaria/shared";
import { requireActionPermission } from "@/lib/auth";

loadDatabaseEnv();

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  cycleId?: string;
};

export async function createBillingCycleDraftAction(input: {
  periodStart: string;
  periodEnd: string;
  propertyId?: string;
}): Promise<ActionResult> {
  const user = await requireActionPermission("billing.manage");
  return withDbAction(async (db) => {
    const propertyId = resolveActionPropertyId(user, input.propertyId);

    if (!propertyId) {
      return { ok: false, error: "Selecciona una propiedad para crear el corte." };
    }

    const parsed = billingCycleCreateSchema.safeParse({
      propertyId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      createdBy: user.email
    });

    if (!parsed.success) {
      return { ok: false, error: "Periodo inválido." };
    }

    const detail = await createBillingCycleDraft(
      db,
      propertyId,
      parsed.data.periodStart,
      parsed.data.periodEnd,
      user.email
    );
    revalidateBillingPaths(detail.cycle.id);

    return {
      ok: true,
      message: "Corte creado.",
      cycleId: detail.cycle.id
    };
  });
}

export async function recalculateBillingCycleAction(billingCycleId: string): Promise<ActionResult> {
  await requireActionPermission("billing.manage");
  const parsed = billingCycleIdSchema.safeParse({ billingCycleId });

  if (!parsed.success) {
    return { ok: false, error: "Corte inválido." };
  }

  return withDbAction(async (db) => {
    await recalculateBillingCycle(db, parsed.data.billingCycleId);
    revalidateBillingPaths(parsed.data.billingCycleId);
    return { ok: true, message: "Corte recalculado." };
  });
}

export async function approveBillingCycleAction(billingCycleId: string): Promise<ActionResult> {
  const user = await requireActionPermission("billing.approve");
  const parsed = billingCycleIdSchema.safeParse({ billingCycleId });

  if (!parsed.success) {
    return { ok: false, error: "Corte inválido." };
  }

  return withDbAction(async (db) => {
    await approveBillingCycle(db, parsed.data.billingCycleId, user.email);
    revalidateBillingPaths(parsed.data.billingCycleId);
    return { ok: true, message: "Corte aprobado." };
  });
}

export async function closeBillingCycleAction(billingCycleId: string): Promise<ActionResult> {
  await requireActionPermission("billing.approve");
  const parsed = billingCycleIdSchema.safeParse({ billingCycleId });

  if (!parsed.success) {
    return { ok: false, error: "Corte inválido." };
  }

  return withDbAction(async (db) => {
    await closeBillingCycle(db, parsed.data.billingCycleId);
    revalidateBillingPaths(parsed.data.billingCycleId);
    return { ok: true, message: "Corte cerrado." };
  });
}

export async function updateBillingCycleItemAdjustmentAction(input: {
  itemId: string;
  adjustmentAmount: number;
  adjustmentReason: string;
}): Promise<ActionResult> {
  await requireActionPermission("billing.manage");
  const parsed = billingCycleItemAdjustmentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Ajuste inválido." };
  }

  return withDbAction(async (db) => {
    const item = await updateBillingCycleItemAdjustment({
      db,
      itemId: parsed.data.itemId,
      adjustmentAmount: parsed.data.adjustmentAmount,
      adjustmentReason: parsed.data.adjustmentReason
    });
    revalidateBillingPaths(item.billingCycleId);
    return { ok: true, message: "Ajuste aplicado." };
  });
}

export async function excludeSessionFromCycleAction(input: {
  billingCycleId: string;
  sessionId: string;
  reason: string;
}): Promise<ActionResult> {
  await requireActionPermission("billing.manage");
  const cycle = recordIdSchema.safeParse(input.billingCycleId);
  const session = recordIdSchema.safeParse(input.sessionId);

  if (!cycle.success || !session.success || input.reason.trim().length < 2) {
    return { ok: false, error: "Datos inválidos." };
  }

  return withDbAction(async (db) => {
    await excludeSessionFromCycle({
      db,
      billingCycleId: cycle.data,
      sessionId: session.data,
      reason: input.reason
    });
    revalidateBillingPaths(cycle.data);
    return { ok: true, message: "Sesión excluida del corte." };
  });
}

export async function includeSessionInCycleAction(input: {
  billingCycleId: string;
  sessionId: string;
}): Promise<ActionResult> {
  await requireActionPermission("billing.manage");
  const cycle = recordIdSchema.safeParse(input.billingCycleId);
  const session = recordIdSchema.safeParse(input.sessionId);

  if (!cycle.success || !session.success) {
    return { ok: false, error: "Datos inválidos." };
  }

  return withDbAction(async (db) => {
    await includeSessionInCycle({
      db,
      billingCycleId: cycle.data,
      sessionId: session.data
    });
    revalidateBillingPaths(cycle.data);
    return { ok: true, message: "Sesión incluida en el corte." };
  });
}

function resolveActionPropertyId(user: CurrentUser, propertyId?: string) {
  if (propertyId) {
    const hasTenantAccess = user.memberships.some(
      (membership) => membership.status === "active" && membership.propertyId === propertyId
    );
    const hasPlatformAccess =
      user.permissions.includes("platform.impersonate_property") &&
      user.permissions.includes("platform.tenants.view");

    return hasTenantAccess || hasPlatformAccess ? propertyId : null;
  }

  const activeMemberships = user.memberships.filter((membership) => membership.status === "active");

  return activeMemberships.length === 1 ? activeMemberships[0]?.propertyId ?? null : null;
}

async function withDbAction(
  load: (db: ReturnType<typeof createDbClient>["db"]) => Promise<ActionResult>
): Promise<ActionResult> {
  let context: ReturnType<typeof createDbClient> | null = null;

  try {
    context = createDbClient();
    return await load(context.db);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo ejecutar la acción."
    };
  } finally {
    await context?.client.end();
  }
}

function revalidateBillingPaths(cycleId?: string) {
  revalidatePath("/billing");
  revalidatePath("/billing/cycles");
  if (cycleId) {
    revalidatePath(`/billing/cycles/${cycleId}`);
  }
  revalidatePath("/audit");
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
}
