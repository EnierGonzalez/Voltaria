"use server";

import { revalidatePath } from "next/cache";
import {
  cancelCredentialEnrollment,
  createDbClient,
  createManualRfidCredential,
  disableCredential,
  getCredentialEnrollmentById,
  getResidentById,
  loadDatabaseEnv,
  markCredentialDamaged,
  markCredentialLost,
  markCredentialStolen,
  replaceCredentialStart,
  startCredentialEnrollment,
  type CredentialServiceResult,
  type CurrentUser
} from "@voltaria/db";
import {
  credentialDisableReasonSchema,
  credentialLabelSchema,
  recordIdSchema,
  rfidTagSchema
} from "@voltaria/shared";
import { requireActionPermission } from "@/lib/auth";

loadDatabaseEnv();

export async function createManualRfidCredentialAction(input: {
  residentId: string;
  rawIdTag: string;
  label?: string;
}): Promise<CredentialServiceResult> {
  const user = await requireActionPermission("credentials.manage");
  const residentId = recordIdSchema.safeParse(input.residentId);
  const rawIdTag = rfidTagSchema.safeParse(input.rawIdTag);
  const label = input.label ? credentialLabelSchema.safeParse(input.label) : null;

  if (!residentId.success || !rawIdTag.success || label?.success === false) {
    return { ok: false, error: "Datos de RFID inválidos.", reason: "invalid_payload" };
  }

  return withCredentialDbAction(async (db) => {
    const propertyId = await resolveResidentPropertyId(db, residentId.data, user);

    if (!propertyId) {
      return { ok: false, error: "Residente no encontrado o sin acceso.", reason: "property_not_found" };
    }

    const result = await createManualRfidCredential(db, {
      propertyId,
      residentId: residentId.data,
      rawIdTag: rawIdTag.data,
      ...(label?.success ? { label: label.data } : {}),
      performedBy: user.email
    });

    revalidateResidentPaths(residentId.data);
    return result;
  });
}

export async function startCredentialEnrollmentAction(input: {
  residentId: string;
  mode: "assign" | "replace";
  accessDeviceId?: string;
  oldCredentialId?: string;
  reason?: string;
}): Promise<CredentialServiceResult> {
  const user = await requireActionPermission("credentials.manage");
  const residentId = recordIdSchema.safeParse(input.residentId);
  const accessDeviceId = input.accessDeviceId ? recordIdSchema.safeParse(input.accessDeviceId) : null;
  const oldCredentialId = input.oldCredentialId ? recordIdSchema.safeParse(input.oldCredentialId) : null;
  const reason = input.reason ? credentialDisableReasonSchema.safeParse(input.reason) : null;

  if (
    !residentId.success ||
    (input.mode !== "assign" && input.mode !== "replace") ||
    accessDeviceId?.success === false ||
    oldCredentialId?.success === false ||
    reason?.success === false
  ) {
    return { ok: false, error: "Datos de captura inválidos.", reason: "invalid_payload" };
  }

  return withCredentialDbAction(async (db) => {
    const propertyId = await resolveResidentPropertyId(db, residentId.data, user);

    if (!propertyId) {
      return { ok: false, error: "Residente no encontrado o sin acceso.", reason: "property_not_found" };
    }

    const result = await startCredentialEnrollment(db, {
      propertyId,
      residentId: residentId.data,
      mode: input.mode,
      ...(accessDeviceId?.success ? { accessDeviceId: accessDeviceId.data } : {}),
      ...(oldCredentialId?.success ? { oldCredentialId: oldCredentialId.data } : {}),
      ...(reason?.success ? { reason: reason.data } : {}),
      createdBy: user.email
    });

    revalidateResidentPaths(residentId.data);
    return result;
  });
}

export async function replaceCredentialStartAction(input: {
  credentialId: string;
  reason: string;
  accessDeviceId?: string;
}): Promise<CredentialServiceResult> {
  await requireActionPermission("credentials.replace");
  const credentialId = recordIdSchema.safeParse(input.credentialId);
  const accessDeviceId = input.accessDeviceId ? recordIdSchema.safeParse(input.accessDeviceId) : null;
  const reason = credentialDisableReasonSchema.safeParse(input.reason);

  if (!credentialId.success || !reason.success || accessDeviceId?.success === false) {
    return { ok: false, error: "Datos de reemplazo inválidos.", reason: "invalid_payload" };
  }

  return withCredentialDbAction(async (db) => {
    const result = await replaceCredentialStart(
      db,
      credentialId.data,
      reason.data,
      accessDeviceId?.success ? accessDeviceId.data : undefined
    );
    revalidatePath("/residents");
    return result;
  });
}

export async function cancelCredentialEnrollmentAction(enrollmentId: string): Promise<CredentialServiceResult> {
  await requireActionPermission("credentials.manage");
  const parsed = recordIdSchema.safeParse(enrollmentId);

  if (!parsed.success) {
    return { ok: false, error: "Captura inválida.", reason: "invalid_enrollment" };
  }

  return withCredentialDbAction(async (db) => {
    const result = await cancelCredentialEnrollment(db, parsed.data);
    revalidatePath("/residents");
    return result;
  });
}

export async function getEnrollmentStatusAction(enrollmentId: string) {
  await requireActionPermission("credentials.view");
  const parsed = recordIdSchema.safeParse(enrollmentId);

  if (!parsed.success) {
    return { ok: false as const, error: "Captura inválida." };
  }

  return withCredentialDbAction(async (db) => {
    const enrollment = await getCredentialEnrollmentById(db, parsed.data);

    if (!enrollment) {
      return { ok: false as const, error: "Captura no encontrada." };
    }

    return {
      ok: true as const,
      status: enrollment.status,
      maskedValue: enrollment.capturedMaskedValue ?? undefined
    };
  });
}

export async function disableCredentialAction(credentialId: string, reason: string) {
  await requireActionPermission("credentials.disable");
  return updateCredentialStatusAction(credentialId, reason, "disabled");
}

export async function markCredentialLostAction(credentialId: string) {
  await requireActionPermission("credentials.disable");
  return updateCredentialStatusAction(credentialId, "lost", "lost");
}

export async function markCredentialStolenAction(credentialId: string) {
  await requireActionPermission("credentials.disable");
  return updateCredentialStatusAction(credentialId, "stolen", "stolen");
}

export async function markCredentialDamagedAction(credentialId: string) {
  await requireActionPermission("credentials.disable");
  return updateCredentialStatusAction(credentialId, "damaged", "damaged");
}

async function updateCredentialStatusAction(
  credentialId: string,
  reason: string,
  status: "disabled" | "lost" | "stolen" | "damaged"
) {
  const parsedCredentialId = recordIdSchema.safeParse(credentialId);
  const parsedReason = credentialDisableReasonSchema.safeParse(reason);

  if (!parsedCredentialId.success || !parsedReason.success) {
    return { ok: false, error: "Datos de credencial inválidos.", reason: "invalid_payload" };
  }

  return withCredentialDbAction(async (db) => {
    const result =
      status === "lost"
        ? await markCredentialLost(db, parsedCredentialId.data)
        : status === "stolen"
          ? await markCredentialStolen(db, parsedCredentialId.data)
          : status === "damaged"
            ? await markCredentialDamaged(db, parsedCredentialId.data)
            : await disableCredential(db, parsedCredentialId.data, parsedReason.data);

    revalidatePath("/residents");
    return result;
  });
}

async function resolveResidentPropertyId(
  db: ReturnType<typeof createDbClient>["db"],
  residentId: string,
  user: CurrentUser
) {
  const resident = await getResidentById(db, residentId);

  if (!resident) {
    return null;
  }

  const hasTenantAccess = user.memberships.some(
    (membership) => membership.status === "active" && membership.propertyId === resident.propertyId
  );
  const hasPlatformAccess =
    user.permissions.includes("platform.impersonate_property") &&
    user.permissions.includes("platform.tenants.view");

  return hasTenantAccess || hasPlatformAccess ? resident.propertyId : null;
}

async function withCredentialDbAction<T>(load: (db: ReturnType<typeof createDbClient>["db"]) => Promise<T>) {
  let context: ReturnType<typeof createDbClient> | null = null;

  try {
    context = createDbClient();
    return await load(context.db);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo ejecutar la acción."
    };
  } finally {
    await context?.client.end();
  }
}

function revalidateResidentPaths(residentId: string) {
  revalidatePath("/residents");
  revalidatePath(`/residents/${residentId}`);
  revalidatePath("/mobile/access");
}
