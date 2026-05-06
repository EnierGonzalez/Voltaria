"use server";

import { revalidatePath } from "next/cache";
import {
  auditSession,
  createDbClient,
  excludeSessionFromBilling,
  getDefaultProperty,
  includeSessionInBilling,
  loadDatabaseEnv,
  markSessionAuditReviewed
} from "@voltaria/db";
import {
  auditBillingStatusUpdateSchema,
  auditReviewUpdateSchema,
  recordIdSchema
} from "@voltaria/shared";

loadDatabaseEnv();

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function auditSessionAction(sessionId: string): Promise<ActionResult> {
  const parsed = recordIdSchema.safeParse(sessionId);

  if (!parsed.success) {
    return { ok: false, error: "Sesión inválida." };
  }

  return withDbAction(async (db) => {
    await auditSession(db, parsed.data);
    revalidateAuditPaths(parsed.data);
    return { ok: true, message: "Sesión auditada." };
  });
}

export async function markSessionReviewedAction(input: {
  sessionId: string;
  notes?: string;
}): Promise<ActionResult> {
  const parsed = auditReviewUpdateSchema.safeParse({
    ...input,
    reviewedBy: "admin"
  });

  if (!parsed.success) {
    return { ok: false, error: "Datos de revisión inválidos." };
  }

  return withDbAction(async (db) => {
    await markSessionAuditReviewed({
      db,
      sessionId: parsed.data.sessionId,
      ...(parsed.data.reviewedBy ? { reviewedBy: parsed.data.reviewedBy } : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {})
    });
    revalidateAuditPaths(parsed.data.sessionId);
    return { ok: true, message: "Sesión marcada como revisada." };
  });
}

export async function excludeSessionFromBillingAction(input: {
  sessionId: string;
  reason: string;
}): Promise<ActionResult> {
  const parsed = auditBillingStatusUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Motivo inválido." };
  }

  return withDbAction(async (db) => {
    await excludeSessionFromBilling({
      db,
      sessionId: parsed.data.sessionId,
      reason: parsed.data.reason
    });
    revalidateAuditPaths(parsed.data.sessionId);
    return { ok: true, message: "Sesión excluida del cobro." };
  });
}

export async function includeSessionInBillingAction(input: {
  sessionId: string;
  reason: string;
}): Promise<ActionResult> {
  const parsed = auditBillingStatusUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Motivo inválido." };
  }

  return withDbAction(async (db) => {
    await includeSessionInBilling({
      db,
      sessionId: parsed.data.sessionId,
      reason: parsed.data.reason
    });
    revalidateAuditPaths(parsed.data.sessionId);
    return { ok: true, message: "Sesión incluida para cobro." };
  });
}

async function withDbAction(
  load: (db: ReturnType<typeof createDbClient>["db"]) => Promise<ActionResult>
): Promise<ActionResult> {
  let context: ReturnType<typeof createDbClient> | null = null;

  try {
    context = createDbClient();
    await getDefaultProperty(context.db);
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

function revalidateAuditPaths(sessionId: string) {
  revalidatePath("/audit");
  revalidatePath("/reports/audit");
  revalidatePath("/billing");
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/dashboard");
}
