import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import type { VoltariaDb } from "./client";
import { hashRfidTag, maskRfidTag, normalizeRfidTag, validateRfidTag } from "./rfid-utils";
import {
  accessDevices,
  authorizationAttempts,
  credentialEnrollmentSessions,
  credentialEvents,
  residentCredentials,
  residents
} from "./schema";

type DbExecutor = Pick<VoltariaDb, "insert" | "select" | "update">;

export type CredentialServiceResult =
  | {
      ok: true;
      message: string;
      credentialId?: string | undefined;
      enrollmentId?: string | undefined;
      maskedValue?: string | undefined;
    }
  | {
      ok: false;
      error: string;
      reason?: string | undefined;
    };

type CredentialStatus =
  | "active"
  | "disabled"
  | "lost"
  | "stolen"
  | "damaged"
  | "replaced"
  | "expired"
  | "pending_enrollment";

export async function getResidentCredentials(db: VoltariaDb, residentId: string) {
  return db
    .select()
    .from(residentCredentials)
    .where(eq(residentCredentials.residentId, residentId))
    .orderBy(desc(residentCredentials.createdAt));
}

export async function getCredentialById(db: VoltariaDb, credentialId: string) {
  const [credential] = await db
    .select()
    .from(residentCredentials)
    .where(eq(residentCredentials.id, credentialId))
    .limit(1);

  return credential ?? null;
}

export async function createManualRfidCredential(
  db: VoltariaDb,
  input: {
    propertyId: string;
    residentId: string;
    rawIdTag: string;
    label?: string | undefined;
    performedBy?: string | undefined;
  }
): Promise<CredentialServiceResult> {
  if (!validateRfidTag(input.rawIdTag)) {
    return { ok: false, error: "El idTag RFID no tiene un formato válido.", reason: "invalid_tag" };
  }

  return db.transaction(async (tx) => {
    const resident = await getActiveResident(tx, input.propertyId, input.residentId);

    if (!resident) {
      return { ok: false, error: "Residente no encontrado o inactivo.", reason: "resident_inactive" };
    }

    const normalized = normalizeRfidTag(input.rawIdTag);
    const hashedValue = hashRfidTag(normalized);
    const maskedValue = maskRfidTag(normalized);
    const duplicate = await findActiveCredentialByHash(tx, input.propertyId, hashedValue);

    if (duplicate) {
      return {
        ok: false,
        error:
          duplicate.residentId === input.residentId
            ? "Esta tarjeta ya está asignada a este residente."
            : "Esta tarjeta ya está asignada a otro residente.",
        reason: "duplicate_active_card"
      };
    }

    const [credential] = await tx
      .insert(residentCredentials)
      .values({
        propertyId: input.propertyId,
        residentId: input.residentId,
        providerKey: "rfid",
        providerSubject: `rfid:${hashedValue}`,
        credentialType: "rfid",
        label: input.label?.trim() || "Tarjeta RFID",
        hashedValue,
        maskedValue,
        status: "active",
        metadata: { source: "manual" }
      })
      .returning();

    if (!credential) {
      return { ok: false, error: "No se pudo crear la credencial RFID.", reason: "create_failed" };
    }

    await recordCredentialEvent(tx, {
      propertyId: input.propertyId,
      residentId: input.residentId,
      credentialId: credential.id,
      action: "credential.created",
      performedBy: input.performedBy ?? "admin:demo",
      metadata: { source: "manual", maskedValue }
    });

    return {
      ok: true,
      message: "Tarjeta RFID asignada correctamente.",
      credentialId: credential.id,
      maskedValue
    };
  });
}

export async function startCredentialEnrollment(
  db: VoltariaDb,
  input: {
    propertyId: string;
    residentId: string;
    mode: "assign" | "replace";
    accessDeviceId?: string | undefined;
    oldCredentialId?: string | undefined;
    reason?: string | undefined;
    createdBy?: string | undefined;
  }
): Promise<CredentialServiceResult> {
  return db.transaction(async (tx) => {
    const resident = await getActiveResident(tx, input.propertyId, input.residentId);

    if (!resident) {
      return { ok: false, error: "Residente no encontrado o inactivo.", reason: "resident_inactive" };
    }

    await expireOldCredentialEnrollments(tx);
    const expiresAt = new Date(Date.now() + 90_000);
    const [enrollment] = await tx
      .insert(credentialEnrollmentSessions)
      .values({
        propertyId: input.propertyId,
        residentId: input.residentId,
        mode: input.mode,
        status: "waiting",
        expiresAt,
        accessDeviceId: input.accessDeviceId,
        oldCredentialId: input.oldCredentialId,
        createdBy: input.createdBy ?? "admin:demo",
        metadata: {
          reason: input.reason,
          blockOldOnComplete: input.mode === "replace" && input.reason !== "lost" && input.reason !== "stolen"
        }
      })
      .returning();

    if (!enrollment) {
      return { ok: false, error: "No se pudo iniciar la captura RFID.", reason: "enrollment_failed" };
    }

    if (input.oldCredentialId && (input.reason === "lost" || input.reason === "stolen")) {
      await updateCredentialStatus(tx, input.oldCredentialId, input.reason, input.reason);
    }

    await recordCredentialEvent(tx, {
      propertyId: input.propertyId,
      residentId: input.residentId,
      credentialId: input.oldCredentialId,
      enrollmentId: enrollment.id,
      action: "credential.enrollment_started",
      reason: input.reason,
      performedBy: input.createdBy ?? "admin:demo",
      metadata: { mode: input.mode }
    });

    return {
      ok: true,
      message: "Captura RFID iniciada. Esperando tarjeta.",
      enrollmentId: enrollment.id
    };
  });
}

export async function cancelCredentialEnrollment(
  db: VoltariaDb,
  enrollmentId: string,
  performedBy = "admin:demo"
): Promise<CredentialServiceResult> {
  return db.transaction(async (tx) => {
    const [enrollment] = await tx
      .select()
      .from(credentialEnrollmentSessions)
      .where(eq(credentialEnrollmentSessions.id, enrollmentId))
      .limit(1);

    if (!enrollment || enrollment.status !== "waiting") {
      return { ok: false, error: "La captura no está activa.", reason: "enrollment_not_waiting" };
    }

    await tx
      .update(credentialEnrollmentSessions)
      .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(credentialEnrollmentSessions.id, enrollment.id));

    await recordCredentialEvent(tx, {
      propertyId: enrollment.propertyId,
      residentId: enrollment.residentId,
      credentialId: enrollment.oldCredentialId ?? undefined,
      enrollmentId: enrollment.id,
      action: "credential.enrollment_cancelled",
      performedBy
    });

    return { ok: true, message: "Captura RFID cancelada.", enrollmentId: enrollment.id };
  });
}

export async function expireOldCredentialEnrollments(db: DbExecutor) {
  const now = new Date();
  const expired = await db
    .select()
    .from(credentialEnrollmentSessions)
    .where(
      and(
        eq(credentialEnrollmentSessions.status, "waiting"),
        lt(credentialEnrollmentSessions.expiresAt, now)
      )
    )
    .limit(50);

  for (const enrollment of expired) {
    await db
      .update(credentialEnrollmentSessions)
      .set({ status: "expired", completedAt: now, updatedAt: now })
      .where(eq(credentialEnrollmentSessions.id, enrollment.id));

    await recordCredentialEvent(db, {
      propertyId: enrollment.propertyId,
      residentId: enrollment.residentId,
      credentialId: enrollment.oldCredentialId ?? undefined,
      enrollmentId: enrollment.id,
      action: "credential.enrollment_expired",
      performedBy: "system"
    });
  }

  return expired.length;
}

export async function completeCredentialEnrollmentFromTap(
  db: VoltariaDb,
  input: {
    propertyId: string;
    rawIdTag: string;
    accessDeviceId?: string;
    performedBy?: string;
  }
): Promise<CredentialServiceResult> {
  if (!validateRfidTag(input.rawIdTag)) {
    return { ok: false, error: "El idTag RFID no tiene un formato válido.", reason: "invalid_tag" };
  }

  return db.transaction(async (tx) => {
    await expireOldCredentialEnrollments(tx);

    const conditions = [
      eq(credentialEnrollmentSessions.propertyId, input.propertyId),
      eq(credentialEnrollmentSessions.status, "waiting"),
      gt(credentialEnrollmentSessions.expiresAt, new Date()),
      input.accessDeviceId
        ? eq(credentialEnrollmentSessions.accessDeviceId, input.accessDeviceId)
        : undefined
    ].filter(Boolean);

    const [enrollment] = await tx
      .select()
      .from(credentialEnrollmentSessions)
      .where(and(...conditions))
      .orderBy(desc(credentialEnrollmentSessions.createdAt))
      .limit(1);

    if (!enrollment) {
      return { ok: false, error: "No hay una captura RFID activa.", reason: "enrollment_not_found" };
    }

    const normalized = normalizeRfidTag(input.rawIdTag);
    const hashedValue = hashRfidTag(normalized);
    const maskedValue = maskRfidTag(normalized);
    const duplicate = await findActiveCredentialByHash(tx, input.propertyId, hashedValue);

    if (duplicate) {
      await tx
        .update(credentialEnrollmentSessions)
        .set({ status: "failed", capturedMaskedValue: maskedValue, completedAt: new Date(), updatedAt: new Date() })
        .where(eq(credentialEnrollmentSessions.id, enrollment.id));

      await recordCredentialEvent(tx, {
        propertyId: input.propertyId,
        residentId: enrollment.residentId,
        credentialId: duplicate.id,
        enrollmentId: enrollment.id,
        action: "credential.authorization_captured_for_enrollment",
        reason: "duplicate_active_card",
        performedBy: input.performedBy ?? "rfid_panel",
        metadata: { maskedValue }
      });

      return {
        ok: false,
        error: "Esta tarjeta ya está asignada a un residente.",
        reason: "duplicate_active_card"
      };
    }

    const [credential] = await tx
      .insert(residentCredentials)
      .values({
        propertyId: input.propertyId,
        residentId: enrollment.residentId,
        providerKey: "rfid",
        providerSubject: `rfid:${hashedValue}`,
        credentialType: "rfid",
        label: enrollment.mode === "replace" ? "Tarjeta RFID reemplazo" : "Tarjeta RFID",
        hashedValue,
        maskedValue,
        status: "active",
        metadata: { source: "enrollment", enrollmentId: enrollment.id }
      })
      .returning();

    if (!credential) {
      return { ok: false, error: "No se pudo crear la credencial capturada.", reason: "create_failed" };
    }

    if (enrollment.mode === "replace" && enrollment.oldCredentialId) {
      await tx
        .update(residentCredentials)
        .set({
          status: "replaced",
          replacedByCredentialId: credential.id,
          disabledAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(residentCredentials.id, enrollment.oldCredentialId));
    }

    await tx
      .update(credentialEnrollmentSessions)
      .set({
        status: "captured",
        capturedMaskedValue: maskedValue,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(credentialEnrollmentSessions.id, enrollment.id));

    await recordCredentialEvent(tx, {
      propertyId: input.propertyId,
      residentId: enrollment.residentId,
      credentialId: credential.id,
      enrollmentId: enrollment.id,
      action: "credential.enrollment_captured",
      performedBy: input.performedBy ?? "rfid_panel",
      metadata: { maskedValue, mode: enrollment.mode }
    });

    await recordCredentialEvent(tx, {
      propertyId: input.propertyId,
      residentId: enrollment.residentId,
      credentialId: credential.id,
      enrollmentId: enrollment.id,
      action: "credential.created",
      performedBy: input.performedBy ?? "rfid_panel",
      metadata: { source: "enrollment", maskedValue }
    });

    return {
      ok: true,
      message: "Tarjeta capturada y asignada correctamente.",
      credentialId: credential.id,
      enrollmentId: enrollment.id,
      maskedValue
    };
  });
}

export async function disableCredential(
  db: VoltariaDb,
  credentialId: string,
  reason = "disabled",
  performedBy = "admin:demo"
) {
  return updateCredentialWithEvent(db, credentialId, "disabled", "credential.disabled", reason, performedBy);
}

export async function replaceCredentialStart(
  db: VoltariaDb,
  credentialId: string,
  reason: string,
  accessDeviceId?: string | undefined
): Promise<CredentialServiceResult> {
  const credential = await getCredentialById(db, credentialId);

  if (!credential) {
    return { ok: false, error: "Credencial no encontrada.", reason: "credential_not_found" };
  }

  return startCredentialEnrollment(db, {
    propertyId: credential.propertyId,
    residentId: credential.residentId,
    mode: "replace",
    oldCredentialId: credential.id,
    accessDeviceId,
    reason
  });
}

export async function markCredentialLost(db: VoltariaDb, credentialId: string) {
  return updateCredentialWithEvent(db, credentialId, "lost", "credential.marked_lost", "lost");
}

export async function markCredentialStolen(db: VoltariaDb, credentialId: string) {
  return updateCredentialWithEvent(db, credentialId, "stolen", "credential.marked_stolen", "stolen");
}

export async function markCredentialDamaged(db: VoltariaDb, credentialId: string) {
  return updateCredentialWithEvent(db, credentialId, "damaged", "credential.marked_damaged", "damaged");
}

export async function findActiveCredentialByRfidTag(
  db: DbExecutor,
  propertyId: string,
  rawIdTag: string
) {
  if (!validateRfidTag(rawIdTag)) {
    return null;
  }

  return findActiveCredentialByHash(db, propertyId, hashRfidTag(rawIdTag));
}

export async function recordCredentialEvent(
  db: DbExecutor,
  input: {
    propertyId: string;
    residentId?: string | undefined;
    credentialId?: string | undefined;
    enrollmentId?: string | undefined;
    action: string;
    reason?: string | undefined;
    performedBy?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }
) {
  await db.insert(credentialEvents).values({
    propertyId: input.propertyId,
    residentId: input.residentId,
    credentialId: input.credentialId,
    enrollmentId: input.enrollmentId,
    action: input.action,
    reason: input.reason,
    performedBy: input.performedBy,
    metadata: input.metadata ?? {}
  });
}

export async function recordAuthorizationAttempt(
  db: DbExecutor,
  input: {
    propertyId: string;
    residentId?: string | undefined;
    credentialId?: string | undefined;
    accessDeviceId?: string | undefined;
    chargerId?: string | undefined;
    method: "rfid" | "mobile" | "admin";
    result: "accepted" | "rejected" | "captured" | "expired" | "blocked";
    reason?: string | undefined;
    maskedValue?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }
) {
  await db.insert(authorizationAttempts).values({
    propertyId: input.propertyId,
    residentId: input.residentId,
    credentialId: input.credentialId,
    accessDeviceId: input.accessDeviceId,
    chargerId: input.chargerId,
    method: input.method,
    result: input.result,
    reason: input.reason,
    maskedValue: input.maskedValue,
    metadata: input.metadata ?? {}
  });
}

async function updateCredentialWithEvent(
  db: VoltariaDb,
  credentialId: string,
  status: CredentialStatus,
  action: string,
  reason: string,
  performedBy = "admin:demo"
): Promise<CredentialServiceResult> {
  return db.transaction(async (tx) => {
    const [credential] = await tx
      .select()
      .from(residentCredentials)
      .where(eq(residentCredentials.id, credentialId))
      .limit(1);

    if (!credential) {
      return { ok: false, error: "Credencial no encontrada.", reason: "credential_not_found" };
    }

    await updateCredentialStatus(tx, credential.id, status, reason);
    await recordCredentialEvent(tx, {
      propertyId: credential.propertyId,
      residentId: credential.residentId,
      credentialId: credential.id,
      action,
      reason,
      performedBy
    });

    return {
      ok: true,
      message: "Estado de credencial actualizado.",
      credentialId: credential.id,
      maskedValue: credential.maskedValue ?? undefined
    };
  });
}

async function updateCredentialStatus(
  db: DbExecutor,
  credentialId: string,
  status: CredentialStatus,
  reason?: string
) {
  await db
    .update(residentCredentials)
    .set({
      status,
      disabledAt: status === "active" || status === "pending_enrollment" ? null : new Date(),
      updatedAt: new Date(),
      ...(reason ? { metadata: { reason } } : {})
    })
    .where(eq(residentCredentials.id, credentialId));
}

async function getActiveResident(db: DbExecutor, propertyId: string, residentId: string) {
  const [resident] = await db
    .select()
    .from(residents)
    .where(and(eq(residents.propertyId, propertyId), eq(residents.id, residentId), eq(residents.isActive, true)))
    .limit(1);

  return resident ?? null;
}

async function findActiveCredentialByHash(db: DbExecutor, propertyId: string, hashedValue: string) {
  const [credential] = await db
    .select()
    .from(residentCredentials)
    .where(
      and(
        eq(residentCredentials.propertyId, propertyId),
        eq(residentCredentials.credentialType, "rfid"),
        eq(residentCredentials.hashedValue, hashedValue),
        inArray(residentCredentials.status, ["active"])
      )
    )
    .limit(1);

  return credential ?? null;
}

export async function getAccessDevices(db: VoltariaDb, propertyId: string) {
  return db
    .select()
    .from(accessDevices)
    .where(eq(accessDevices.propertyId, propertyId))
    .orderBy(accessDevices.name);
}

export async function getCredentialEnrollmentById(db: VoltariaDb, enrollmentId: string) {
  const [enrollment] = await db
    .select()
    .from(credentialEnrollmentSessions)
    .where(eq(credentialEnrollmentSessions.id, enrollmentId))
    .limit(1);

  return enrollment ?? null;
}
