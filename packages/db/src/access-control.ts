import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { VoltariaDb } from "./client";
import {
  completeCredentialEnrollmentFromTap,
  expireOldCredentialEnrollments,
  recordAuthorizationAttempt,
  recordCredentialEvent
} from "./credential-service";
import { hashRfidTag, maskRfidTag, normalizeRfidTag, validateRfidTag } from "./rfid-utils";
import { evaluateStartSession } from "./rules-engine";
import {
  accessDevices,
  apartments,
  chargerConnectors,
  chargers,
  chargingSessions,
  credentialEnrollmentSessions,
  deviceCommands,
  meterValues,
  residentCredentials,
  residents,
  systemEvents,
  tariffs
} from "./schema";

const ACTIVE_SESSION_STATUSES = ["pending_start", "active"] as const;

export type RfidTapResult = {
  result: "captured" | "accepted" | "rejected" | "blocked";
  reason: string;
  maskedValue?: string;
  residentId?: string;
  credentialId?: string;
  sessionId?: string;
  commandId?: string;
  message: string;
};

export async function handleRfidTap(
  db: VoltariaDb,
  input: {
    propertyId?: string | undefined;
    readerCode: string;
    rawIdTag: string;
    outletPublicCode?: string | undefined;
    outletId?: string | undefined;
    source: "rfid_panel" | "rfid_reader" | "simulator";
    timestamp?: Date | undefined;
  }
): Promise<RfidTapResult> {
  if (!validateRfidTag(input.rawIdTag)) {
    return {
      result: "rejected",
      reason: "invalid_tag",
      message: "Tarjeta RFID inválida."
    };
  }

  const normalized = normalizeRfidTag(input.rawIdTag);
  const maskedValue = maskRfidTag(normalized);
  const hashedValue = hashRfidTag(normalized);
  const accessDevice = await findAccessDevice(db, input.readerCode, input.propertyId);

  if (!accessDevice) {
    return {
      result: "rejected",
      reason: "reader_not_found",
      maskedValue,
      message: "Lector no registrado."
    };
  }

  const now = input.timestamp ?? new Date();
  await db
    .update(accessDevices)
    .set({ lastSeenAt: now, status: "online", updatedAt: now })
    .where(eq(accessDevices.id, accessDevice.id));

  await expireOldCredentialEnrollments(db);

  const enrollment = await findWaitingEnrollment(db, accessDevice.propertyId, accessDevice.id);

  if (enrollment) {
    const captured = await completeCredentialEnrollmentFromTap(db, {
      propertyId: accessDevice.propertyId,
      accessDeviceId: accessDevice.id,
      rawIdTag: input.rawIdTag,
      performedBy: input.source
    });

    await recordAuthorizationAttempt(db, {
      propertyId: accessDevice.propertyId,
      residentId: enrollment.residentId,
      accessDeviceId: accessDevice.id,
      chargerId: enrollment.outletId ?? undefined,
      method: "rfid",
      result: "captured",
      reason: captured.ok ? "enrollment_captured" : captured.reason ?? "enrollment_failed",
      maskedValue,
      metadata: { source: input.source, enrollmentId: enrollment.id }
    });

    return {
      result: "captured",
      reason: captured.ok ? "enrollment_captured" : captured.reason ?? "enrollment_failed",
      maskedValue,
      ...(captured.ok && captured.credentialId ? { credentialId: captured.credentialId } : {}),
      residentId: enrollment.residentId,
      message: captured.ok ? "Tarjeta capturada para enrollment." : captured.error
    };
  }

  const credential = await findRfidCredentialByHash(db, accessDevice.propertyId, hashedValue);

  if (!credential) {
    await recordAuthorizationAttempt(db, {
      propertyId: accessDevice.propertyId,
      accessDeviceId: accessDevice.id,
      method: "rfid",
      result: "rejected",
      reason: "unknown_card",
      maskedValue,
      metadata: { source: input.source }
    });

    return {
      result: "rejected",
      reason: "unknown_card",
      maskedValue,
      message: "Tarjeta no registrada."
    };
  }

  if (credential.status !== "active") {
    await recordAuthorizationAttempt(db, {
      propertyId: accessDevice.propertyId,
      residentId: credential.residentId,
      credentialId: credential.id,
      accessDeviceId: accessDevice.id,
      method: "rfid",
      result: "blocked",
      reason: "credential_not_active",
      maskedValue,
      metadata: { source: input.source, credentialStatus: credential.status }
    });

    return {
      result: "blocked",
      reason: "credential_not_active",
      maskedValue,
      residentId: credential.residentId,
      credentialId: credential.id,
      message: "Tarjeta bloqueada."
    };
  }

  const [resident] = await db
    .select({
      id: residents.id,
      propertyId: residents.propertyId,
      apartmentId: residents.apartmentId,
      fullName: residents.fullName,
      isActive: residents.isActive,
      apartmentNumber: apartments.number
    })
    .from(residents)
    .leftJoin(apartments, eq(apartments.id, residents.apartmentId))
    .where(eq(residents.id, credential.residentId))
    .limit(1);

  if (!resident || !resident.isActive) {
    await recordAuthorizationAttempt(db, {
      propertyId: accessDevice.propertyId,
      residentId: credential.residentId,
      credentialId: credential.id,
      accessDeviceId: accessDevice.id,
      method: "rfid",
      result: "blocked",
      reason: "resident_inactive",
      maskedValue,
      metadata: { source: input.source }
    });

    return {
      result: "blocked",
      reason: "resident_inactive",
      maskedValue,
      residentId: credential.residentId,
      credentialId: credential.id,
      message: "Residente suspendido."
    };
  }

  if (!resident.apartmentId) {
    return recordRejected(db, {
      propertyId: accessDevice.propertyId,
      residentId: resident.id,
      credentialId: credential.id,
      accessDeviceId: accessDevice.id,
      reason: "apartment_required",
      maskedValue,
      message: "Departamento suspendido o no asignado.",
      source: input.source
    });
  }

  const explicitOutletId = input.outletId;
  const linkedOutletId = input.outletPublicCode ? undefined : accessDevice.linkedOutletId;
  const outlet = await resolveOutlet(db, {
    propertyId: accessDevice.propertyId,
    ...((explicitOutletId ?? linkedOutletId)
      ? { outletId: explicitOutletId ?? linkedOutletId ?? undefined }
      : {}),
    ...(input.outletPublicCode ? { outletPublicCode: input.outletPublicCode } : {})
  });

  if (!outlet) {
    return recordRejected(db, {
      propertyId: accessDevice.propertyId,
      residentId: resident.id,
      credentialId: credential.id,
      accessDeviceId: accessDevice.id,
      reason: "outlet_required",
      maskedValue,
      message: "Toma no encontrada o no seleccionada.",
      source: input.source
    });
  }

  if (outlet.kind !== "controlled_outlet") {
    return recordRejected(db, {
      propertyId: accessDevice.propertyId,
      residentId: resident.id,
      credentialId: credential.id,
      accessDeviceId: accessDevice.id,
      chargerId: outlet.id,
      reason: "outlet_not_controlled",
      maskedValue,
      message: "La toma no es controlable por RFID.",
      source: input.source
    });
  }

  const existingOwnOutletSession = await getActiveSessionForResidentAndOutlet(db, resident.id, outlet.id);

  if (existingOwnOutletSession) {
    return requestRfidStop(db, {
      propertyId: accessDevice.propertyId,
      residentId: resident.id,
      credentialId: credential.id,
      accessDeviceId: accessDevice.id,
      outletId: outlet.id,
      sessionId: existingOwnOutletSession.id,
      maskedValue,
      source: input.source
    });
  }

  const ruleDecision = await evaluateStartSession(db, {
    propertyId: accessDevice.propertyId,
    residentId: resident.id,
    apartmentId: resident.apartmentId,
    outletId: outlet.id,
    method: "rfid",
    source: "rfid"
  });

  if (!ruleDecision.allowed) {
    await recordAuthorizationAttempt(db, {
      propertyId: accessDevice.propertyId,
      residentId: resident.id,
      credentialId: credential.id,
      accessDeviceId: accessDevice.id,
      chargerId: outlet.id,
      method: "rfid",
      result: ruleDecision.reason === "resident_blocked" || ruleDecision.reason === "apartment_blocked"
        ? "blocked"
        : "rejected",
      reason: ruleDecision.reason,
      maskedValue,
      metadata: { source: input.source, ruleDetails: ruleDecision.details }
    });

    await recordCredentialEvent(db, {
      propertyId: accessDevice.propertyId,
      residentId: resident.id,
      credentialId: credential.id,
      action: "credential.authorization_rejected",
      reason: ruleDecision.reason,
      performedBy: input.source,
      metadata: { maskedValue }
    });

    return {
      result: ruleDecision.reason === "resident_blocked" || ruleDecision.reason === "apartment_blocked"
        ? "blocked"
        : "rejected",
      reason: ruleDecision.reason,
      maskedValue,
      residentId: resident.id,
      credentialId: credential.id,
      message: ruleDecision.message
    };
  }

  if (outlet.status !== "available") {
    return recordRejected(db, {
      propertyId: accessDevice.propertyId,
      residentId: resident.id,
      credentialId: credential.id,
      accessDeviceId: accessDevice.id,
      chargerId: outlet.id,
      reason: "outlet_occupied",
      maskedValue,
      message: "Toma ocupada.",
      source: input.source
    });
  }

  return startRfidOutletSession(db, {
    propertyId: accessDevice.propertyId,
    residentId: resident.id,
    residentName: resident.fullName,
    apartmentId: resident.apartmentId,
    credentialId: credential.id,
    accessDeviceId: accessDevice.id,
    outletId: outlet.id,
    outletCode: outlet.ocppIdentity,
    ...(outlet.publicAccessCode ? { publicAccessCode: outlet.publicAccessCode } : {}),
    voltage: outlet.voltage ?? 120,
    maxCurrentAmp: toNumber(ruleDecision.details.effectiveMaxCurrentAmp) || toNumber(outlet.maxCurrentAmp) || 12,
    maskedValue,
    source: input.source
  });
}

async function startRfidOutletSession(
  db: VoltariaDb,
  input: {
    propertyId: string;
    residentId: string;
    residentName: string;
    apartmentId: string;
    credentialId: string;
    accessDeviceId: string;
    outletId: string;
    outletCode: string;
    publicAccessCode?: string | undefined;
    voltage: number;
    maxCurrentAmp: number;
    maskedValue: string;
    source: string;
  }
): Promise<RfidTapResult> {
  return db.transaction(async (tx) => {
    const [residentActiveSession] = await tx
      .select({ id: chargingSessions.id })
      .from(chargingSessions)
      .where(
        and(
          eq(chargingSessions.residentId, input.residentId),
          inArray(chargingSessions.status, ACTIVE_SESSION_STATUSES)
        )
      )
      .limit(1);

    if (residentActiveSession) {
      await recordAuthorizationAttempt(tx, {
        propertyId: input.propertyId,
        residentId: input.residentId,
        credentialId: input.credentialId,
        accessDeviceId: input.accessDeviceId,
        chargerId: input.outletId,
        method: "rfid",
        result: "rejected",
        reason: "resident_has_active_session",
        maskedValue: input.maskedValue,
        metadata: { source: input.source }
      });

      return {
        result: "rejected",
        reason: "resident_has_active_session",
        maskedValue: input.maskedValue,
        residentId: input.residentId,
        credentialId: input.credentialId,
        message: "Ya tienes una sesión activa."
      };
    }

    const [outletActiveSession] = await tx
      .select({ id: chargingSessions.id })
      .from(chargingSessions)
      .where(
        and(
          eq(chargingSessions.chargerId, input.outletId),
          inArray(chargingSessions.status, ACTIVE_SESSION_STATUSES)
        )
      )
      .limit(1);

    if (outletActiveSession) {
      await recordAuthorizationAttempt(tx, {
        propertyId: input.propertyId,
        residentId: input.residentId,
        credentialId: input.credentialId,
        accessDeviceId: input.accessDeviceId,
        chargerId: input.outletId,
        method: "rfid",
        result: "rejected",
        reason: "outlet_occupied",
        maskedValue: input.maskedValue,
        metadata: { source: input.source }
      });

      return {
        result: "rejected",
        reason: "outlet_occupied",
        maskedValue: input.maskedValue,
        residentId: input.residentId,
        credentialId: input.credentialId,
        message: "Toma ocupada."
      };
    }

    const [tariff] = await tx
      .select()
      .from(tariffs)
      .where(and(eq(tariffs.propertyId, input.propertyId), eq(tariffs.isActive, true)))
      .orderBy(desc(tariffs.validFrom))
      .limit(1);

    if (!tariff) {
      await recordAuthorizationAttempt(tx, {
        propertyId: input.propertyId,
        residentId: input.residentId,
        credentialId: input.credentialId,
        accessDeviceId: input.accessDeviceId,
        chargerId: input.outletId,
        method: "rfid",
        result: "rejected",
        reason: "tariff_required",
        maskedValue: input.maskedValue,
        metadata: { source: input.source }
      });

      return {
        result: "rejected",
        reason: "tariff_required",
        maskedValue: input.maskedValue,
        residentId: input.residentId,
        credentialId: input.credentialId,
        message: "No hay tarifa activa."
      };
    }

    const [connector] = await tx
      .select()
      .from(chargerConnectors)
      .where(eq(chargerConnectors.chargerId, input.outletId))
      .orderBy(asc(chargerConnectors.connectorNumber))
      .limit(1);

    const meterStartWh = await getLatestOutletEnergyWh(tx, input.outletId);
    const now = new Date();
    const [session] = await tx
      .insert(chargingSessions)
      .values({
        propertyId: input.propertyId,
        chargerId: input.outletId,
        connectorId: connector?.id,
        residentId: input.residentId,
        apartmentId: input.apartmentId,
        activationMethod: "rfid",
        status: "pending_start",
        startedAt: now,
        meterStartWh,
        energyKwh: "0.000",
        peakPowerKw: "0.00",
        averagePowerKw: "0.00",
        costAmount: "0.00",
        currency: tariff.currency
      })
      .returning();

    if (!session) {
      return {
        result: "rejected",
        reason: "session_create_failed",
        maskedValue: input.maskedValue,
        message: "No se pudo crear la sesión."
      };
    }

    const [command] = await tx
      .insert(deviceCommands)
      .values({
        propertyId: input.propertyId,
        chargerId: input.outletId,
        sessionId: session.id,
        commandType: "enable",
        status: "pending",
        payload: {
          outletId: input.outletId,
          publicAccessCode: input.publicAccessCode,
          sessionId: session.id,
          requestedMethod: "rfid",
          accessDeviceId: input.accessDeviceId,
          voltage: input.voltage,
          maxCurrentAmp: input.maxCurrentAmp,
          tariffRatePerKwh: toNumber(tariff.ratePerKwh)
        },
        requestedBy: `credential:${input.credentialId}`
      })
      .returning();

    await tx
      .update(residentCredentials)
      .set({ lastUsedAt: now, updatedAt: now })
      .where(eq(residentCredentials.id, input.credentialId));

    await recordAuthorizationAttempt(tx, {
      propertyId: input.propertyId,
      residentId: input.residentId,
      credentialId: input.credentialId,
      accessDeviceId: input.accessDeviceId,
      chargerId: input.outletId,
      method: "rfid",
      result: "accepted",
      reason: "session_started",
      maskedValue: input.maskedValue,
      metadata: { source: input.source, sessionId: session.id, commandId: command?.id }
    });

    await recordCredentialEvent(tx, {
      propertyId: input.propertyId,
      residentId: input.residentId,
      credentialId: input.credentialId,
      action: "credential.authorization_accepted",
      performedBy: input.source,
      metadata: { maskedValue: input.maskedValue, sessionId: session.id, commandId: command?.id }
    });

    await tx.insert(systemEvents).values({
      propertyId: input.propertyId,
      chargerId: input.outletId,
      sessionId: session.id,
      severity: "info",
      eventType: "outlet_session_start_requested",
      message: `${input.residentName} autorizó RFID en ${input.outletCode}.`,
      metadata: {
        activationMethod: "rfid",
        credentialId: input.credentialId,
        accessDeviceId: input.accessDeviceId,
        commandId: command?.id
      },
      occurredAt: now
    });

    return {
      result: "accepted",
      reason: "session_started",
      maskedValue: input.maskedValue,
      residentId: input.residentId,
      credentialId: input.credentialId,
      sessionId: session.id,
      ...(command ? { commandId: command.id } : {}),
      message: "Carga autorizada."
    };
  });
}

async function requestRfidStop(
  db: VoltariaDb,
  input: {
    propertyId: string;
    residentId: string;
    credentialId: string;
    accessDeviceId: string;
    outletId: string;
    sessionId: string;
    maskedValue: string;
    source: string;
  }
): Promise<RfidTapResult> {
  return db.transaction(async (tx) => {
    const [existingCommand] = await tx
      .select({ id: deviceCommands.id })
      .from(deviceCommands)
      .where(
        and(
          eq(deviceCommands.sessionId, input.sessionId),
          eq(deviceCommands.commandType, "disable"),
          inArray(deviceCommands.status, ["pending", "sent"])
        )
      )
      .limit(1);

    const command =
      existingCommand ??
      (
        await tx
          .insert(deviceCommands)
          .values({
            propertyId: input.propertyId,
            chargerId: input.outletId,
            sessionId: input.sessionId,
            commandType: "disable",
            status: "pending",
            payload: {
              outletId: input.outletId,
              sessionId: input.sessionId,
              requestedMethod: "rfid",
              accessDeviceId: input.accessDeviceId
            },
            requestedBy: `credential:${input.credentialId}`
          })
          .returning({ id: deviceCommands.id })
      )[0];

    await recordAuthorizationAttempt(tx, {
      propertyId: input.propertyId,
      residentId: input.residentId,
      credentialId: input.credentialId,
      accessDeviceId: input.accessDeviceId,
      chargerId: input.outletId,
      method: "rfid",
      result: "accepted",
      reason: "stop_requested",
      maskedValue: input.maskedValue,
      metadata: { source: input.source, sessionId: input.sessionId, commandId: command?.id }
    });

    await recordCredentialEvent(tx, {
      propertyId: input.propertyId,
      residentId: input.residentId,
      credentialId: input.credentialId,
      action: "credential.authorization_accepted",
      reason: "stop_requested",
      performedBy: input.source,
      metadata: { maskedValue: input.maskedValue, sessionId: input.sessionId, commandId: command?.id }
    });

    return {
      result: "accepted",
      reason: "stop_requested",
      maskedValue: input.maskedValue,
      residentId: input.residentId,
      credentialId: input.credentialId,
      sessionId: input.sessionId,
      ...(command ? { commandId: command.id } : {}),
      message: "Apagado solicitado por RFID."
    };
  });
}

async function findAccessDevice(db: VoltariaDb, readerCode: string, propertyId?: string | undefined) {
  const conditions = [
    eq(accessDevices.code, readerCode),
    propertyId ? eq(accessDevices.propertyId, propertyId) : undefined
  ].filter(Boolean);

  const [device] = await db
    .select()
    .from(accessDevices)
    .where(and(...conditions))
    .limit(1);

  return device ?? null;
}

async function findWaitingEnrollment(db: VoltariaDb, propertyId: string, accessDeviceId: string) {
  const [enrollment] = await db
    .select()
    .from(credentialEnrollmentSessions)
    .where(
      and(
        eq(credentialEnrollmentSessions.propertyId, propertyId),
        eq(credentialEnrollmentSessions.accessDeviceId, accessDeviceId),
        eq(credentialEnrollmentSessions.status, "waiting"),
        inArray(credentialEnrollmentSessions.mode, ["assign", "replace"])
      )
    )
    .orderBy(desc(credentialEnrollmentSessions.createdAt))
    .limit(1);

  if (!enrollment || enrollment.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return enrollment;
}

async function findRfidCredentialByHash(db: VoltariaDb, propertyId: string, hashedValue: string) {
  const [credential] = await db
    .select()
    .from(residentCredentials)
    .where(
      and(
        eq(residentCredentials.propertyId, propertyId),
        eq(residentCredentials.credentialType, "rfid"),
        eq(residentCredentials.hashedValue, hashedValue)
      )
    )
    .orderBy(desc(residentCredentials.updatedAt))
    .limit(1);

  return credential ?? null;
}

async function resolveOutlet(
  db: VoltariaDb,
  input: { propertyId: string; outletPublicCode?: string | undefined; outletId?: string | undefined }
) {
  if (!input.outletId && !input.outletPublicCode) {
    return null;
  }

  const conditions = [
    eq(chargers.propertyId, input.propertyId),
    input.outletId ? eq(chargers.id, input.outletId) : undefined,
    input.outletPublicCode ? eq(chargers.publicAccessCode, input.outletPublicCode) : undefined
  ].filter(Boolean);

  const [outlet] = await db
    .select()
    .from(chargers)
    .where(and(...conditions))
    .limit(1);

  return outlet ?? null;
}

async function getActiveSessionForResidentAndOutlet(
  db: VoltariaDb,
  residentId: string,
  outletId: string
) {
  const [session] = await db
    .select()
    .from(chargingSessions)
    .where(
      and(
        eq(chargingSessions.residentId, residentId),
        eq(chargingSessions.chargerId, outletId),
        inArray(chargingSessions.status, ACTIVE_SESSION_STATUSES)
      )
    )
    .orderBy(desc(chargingSessions.startedAt))
    .limit(1);

  return session ?? null;
}

async function getLatestOutletEnergyWh(
  db: Pick<VoltariaDb, "select">,
  outletId: string
) {
  const [latest] = await db
    .select({ energyWh: meterValues.energyWh })
    .from(meterValues)
    .where(eq(meterValues.chargerId, outletId))
    .orderBy(desc(meterValues.sampledAt))
    .limit(1);

  return latest?.energyWh ?? 0;
}

async function recordRejected(
  db: VoltariaDb,
  input: {
    propertyId: string;
    residentId?: string | undefined;
    credentialId?: string | undefined;
    accessDeviceId: string;
    chargerId?: string | undefined;
    reason: string;
    maskedValue: string;
    message: string;
    source: string;
  }
): Promise<RfidTapResult> {
  await recordAuthorizationAttempt(db, {
    propertyId: input.propertyId,
    residentId: input.residentId,
    credentialId: input.credentialId,
    accessDeviceId: input.accessDeviceId,
    chargerId: input.chargerId,
    method: "rfid",
    result: "rejected",
    reason: input.reason,
    maskedValue: input.maskedValue,
    metadata: { source: input.source }
  });

  if (input.credentialId) {
    await recordCredentialEvent(db, {
      propertyId: input.propertyId,
      residentId: input.residentId,
      credentialId: input.credentialId,
      action: "credential.authorization_rejected",
      reason: input.reason,
      performedBy: input.source,
      metadata: { maskedValue: input.maskedValue }
    });
  }

  return {
    result: "rejected",
    reason: input.reason,
    maskedValue: input.maskedValue,
    ...(input.residentId ? { residentId: input.residentId } : {}),
    ...(input.credentialId ? { credentialId: input.credentialId } : {}),
    message: input.message
  };
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}
