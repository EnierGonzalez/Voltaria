"use server";

import { revalidatePath } from "next/cache";
import {
  createDbClient,
  loadDatabaseEnv,
  setOutletAccessOverride,
  setResidentAccessOverride,
  updatePropertyAccessRule
} from "@voltaria/db";
import {
  outletAccessOverrideUpdateSchema,
  propertyAccessRuleUpdateSchema,
  residentAccessOverrideUpdateSchema,
  type OutletAccessOverrideUpdateInput,
  type PropertyAccessRuleUpdateInput,
  type ResidentAccessOverrideUpdateInput
} from "@voltaria/shared";

loadDatabaseEnv();

type RuleActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function updatePropertyAccessRuleAction(
  input: PropertyAccessRuleUpdateInput
): Promise<RuleActionResult> {
  const parsed = propertyAccessRuleUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Configuración de reglas inválida." };
  }

  return withRulesDbAction(async (db) => {
    const result = await updatePropertyAccessRule(db, parsed.data);
    revalidateRulesPaths();
    return result;
  });
}

export async function setOutletAccessOverrideAction(
  input: OutletAccessOverrideUpdateInput
): Promise<RuleActionResult> {
  // TODO(auth): require an authenticated operator role before changing live outlet access.
  const parsed = outletAccessOverrideUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Configuración de toma inválida." };
  }

  return withRulesDbAction(async (db) => {
    const result = await setOutletAccessOverride(db, parsed.data);
    revalidateRuntimePaths();
    return result;
  });
}

export async function setResidentAccessOverrideAction(
  input: ResidentAccessOverrideUpdateInput
): Promise<RuleActionResult> {
  // TODO(auth): require an authenticated operator role before changing resident access.
  const parsed = residentAccessOverrideUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Configuración del residente inválida." };
  }

  return withRulesDbAction(async (db) => {
    const result = await setResidentAccessOverride(db, parsed.data);
    revalidateRuntimePaths();
    revalidatePath(`/residents/${parsed.data.residentId}`);
    return result;
  });
}

async function withRulesDbAction(
  load: (db: ReturnType<typeof createDbClient>["db"]) => Promise<RuleActionResult>
): Promise<RuleActionResult> {
  let context: ReturnType<typeof createDbClient> | null = null;

  try {
    context = createDbClient();
    return await load(context.db);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar la regla."
    };
  } finally {
    await context?.client.end();
  }
}

function revalidateRulesPaths() {
  revalidatePath("/settings");
  revalidatePath("/settings/rules");
  revalidateRuntimePaths();
}

function revalidateRuntimePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/outlets");
  revalidatePath("/mobile/outlets");
  revalidatePath("/mobile/charge");
  revalidatePath("/rfid-simulator");
}
