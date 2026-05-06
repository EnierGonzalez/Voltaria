"use server";

import { revalidatePath } from "next/cache";
import {
  adminDisableOutlet as dbAdminDisableOutlet,
  adminEnableOutlet as dbAdminEnableOutlet,
  createDbClient,
  loadDatabaseEnv,
  requestStopOutletSession,
  startMobileOutletSession as dbStartMobileOutletSession,
  type RuntimeResult
} from "@voltaria/db";
import { publicAccessCodeSchema, recordIdSchema } from "@voltaria/shared";
import {
  getCurrentResidentContext,
  isDevelopmentAuthFallbackAllowed,
  requireActionPermission
} from "@/lib/auth";

loadDatabaseEnv();

type OutletActionResult = RuntimeResult;

export async function startMobileOutletSession(publicCode: string): Promise<OutletActionResult> {
  const parsed = publicAccessCodeSchema.safeParse(publicCode);

  if (!parsed.success) {
    return { ok: false, error: "Código de toma inválido." };
  }

  return withDbAction(async (db) => {
    const residentContext = await getCurrentResidentContext();

    if (!residentContext && !isDevelopmentAuthFallbackAllowed()) {
      return { ok: false, error: "Debes iniciar sesión como residente." };
    }

    const result = await dbStartMobileOutletSession(db, parsed.data, {
      ...(residentContext?.residentId ? { residentId: residentContext.residentId } : {})
    });
    revalidateOutletPaths(parsed.data);
    return result;
  });
}

export async function stopMobileOutletSession(sessionId: string): Promise<OutletActionResult> {
  const parsed = recordIdSchema.safeParse(sessionId);

  if (!parsed.success) {
    return { ok: false, error: "Sesión inválida." };
  }

  return withDbAction(async (db) => {
    const residentContext = await getCurrentResidentContext();

    if (!residentContext && !isDevelopmentAuthFallbackAllowed()) {
      return { ok: false, error: "Debes iniciar sesión como residente." };
    }

    const result = await requestStopOutletSession(db, parsed.data, {
      requestedBy: "mobile",
      ...(!residentContext ? { requireDemoResident: true } : {}),
      ...(residentContext?.residentId ? { residentId: residentContext.residentId } : {})
    });
    revalidateRuntimePaths();
    return result;
  });
}

export async function adminStopOutletSession(sessionId: string): Promise<OutletActionResult> {
  await requireActionPermission("sessions.stop");
  const parsed = recordIdSchema.safeParse(sessionId);

  if (!parsed.success) {
    return { ok: false, error: "Sesión inválida." };
  }

  return withDbAction(async (db) => {
    const result = await requestStopOutletSession(db, parsed.data, { requestedBy: "admin" });
    revalidateRuntimePaths();
    return result;
  });
}

export async function adminDisableOutlet(outletId: string): Promise<OutletActionResult> {
  await requireActionPermission("outlets.control");
  const parsed = recordIdSchema.safeParse(outletId);

  if (!parsed.success) {
    return { ok: false, error: "Toma inválida." };
  }

  return withDbAction(async (db) => {
    const result = await dbAdminDisableOutlet(db, parsed.data);
    revalidateRuntimePaths();
    return result;
  });
}

export async function adminEnableOutlet(outletId: string): Promise<OutletActionResult> {
  await requireActionPermission("outlets.control");
  const parsed = recordIdSchema.safeParse(outletId);

  if (!parsed.success) {
    return { ok: false, error: "Toma inválida." };
  }

  return withDbAction(async (db) => {
    const result = await dbAdminEnableOutlet(db, parsed.data);
    revalidateRuntimePaths();
    return result;
  });
}

async function withDbAction(
  load: (db: ReturnType<typeof createDbClient>["db"]) => Promise<OutletActionResult>
): Promise<OutletActionResult> {
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

function revalidateOutletPaths(publicCode: string) {
  revalidateRuntimePaths();
  revalidatePath(`/mobile/outlets/${publicCode}`);
}

function revalidateRuntimePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/outlets");
  revalidatePath("/chargers");
  revalidatePath("/mobile/outlets");
  revalidatePath("/mobile/charge");
}
