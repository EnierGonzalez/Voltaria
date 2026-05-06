import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { VoltariaDb } from "./client";
import {
  apartments,
  chargers,
  chargingSessions,
  deviceCommands,
  meterValues,
  residents,
  ruleEvaluations,
  sessionAudits
} from "./schema";

type NewSessionAudit = typeof sessionAudits.$inferInsert;

const ENERGY_DELTA_TOLERANCE_KWH = 0.05;
const MAX_REASONABLE_POWER_KW = 1.8;
const MIN_BILLABLE_KWH = 0.05;

const ruleStopReasons = new Set([
  "max_duration_reached",
  "max_kwh_reached",
  "startup_no_load_timeout",
  "no_load_completed",
  "overcurrent",
  "stopped_by_rule",
  "rule_limit"
]);

export async function auditSession(db: VoltariaDb, sessionId: string) {
  const [session] = await db
    .select({
      id: chargingSessions.id,
      propertyId: chargingSessions.propertyId,
      residentId: chargingSessions.residentId,
      apartmentId: chargingSessions.apartmentId,
      chargerId: chargingSessions.chargerId,
      status: chargingSessions.status,
      activationMethod: chargingSessions.activationMethod,
      startedAt: chargingSessions.startedAt,
      endedAt: chargingSessions.endedAt,
      meterStartWh: chargingSessions.meterStartWh,
      meterStopWh: chargingSessions.meterStopWh,
      energyKwh: chargingSessions.energyKwh,
      peakPowerKw: chargingSessions.peakPowerKw,
      averagePowerKw: chargingSessions.averagePowerKw,
      costAmount: chargingSessions.costAmount,
      stopReason: chargingSessions.stopReason,
      chargerKind: chargers.kind,
      residentActive: residents.isActive
    })
    .from(chargingSessions)
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .leftJoin(residents, eq(residents.id, chargingSessions.residentId))
    .leftJoin(apartments, eq(apartments.id, chargingSessions.apartmentId))
    .where(eq(chargingSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error("Sesión no encontrada.");
  }

  const meterRows = await db
    .select({
      energyWh: meterValues.energyWh,
      powerW: meterValues.powerW,
      sampledAt: meterValues.sampledAt
    })
    .from(meterValues)
    .where(eq(meterValues.sessionId, session.id))
    .orderBy(meterValues.sampledAt);

  const commands = await db
    .select({
      commandType: deviceCommands.commandType,
      status: deviceCommands.status,
      acknowledgedAt: deviceCommands.acknowledgedAt
    })
    .from(deviceCommands)
    .where(eq(deviceCommands.sessionId, session.id));

  const rules = await db
    .select({
      result: ruleEvaluations.result,
      reason: ruleEvaluations.reason
    })
    .from(ruleEvaluations)
    .where(eq(ruleEvaluations.sessionId, session.id))
    .orderBy(desc(ruleEvaluations.createdAt));

  const energyKwh = toNumber(session.energyKwh);
  const maxMeterPowerKw = meterRows.reduce(
    (max, row) => Math.max(max, (row.powerW ?? 0) / 1000),
    0
  );
  const recordedMaxPowerKw = Math.max(
    maxMeterPowerKw,
    toNumber(session.peakPowerKw),
    toNumber(session.averagePowerKw)
  );

  const firstMeterEnergyWh = meterRows.find((row) => row.energyWh !== null)?.energyWh ?? null;
  const lastMeterEnergyWh =
    [...meterRows].reverse().find((row) => row.energyWh !== null)?.energyWh ?? null;
  const meterDeltaKwh =
    session.meterStartWh !== null && session.meterStopWh !== null
      ? (session.meterStopWh - session.meterStartWh) / 1000
      : firstMeterEnergyWh !== null && lastMeterEnergyWh !== null
        ? Math.max(0, (lastMeterEnergyWh - firstMeterEnergyWh) / 1000)
        : null;

  const hasMeterMismatch =
    meterDeltaKwh !== null && Math.abs(meterDeltaKwh - energyKwh) > ENERGY_DELTA_TOLERANCE_KWH;
  const hasMeterValues = meterRows.length > 0;
  const hasEnableTimeout = commands.some(
    (command) => command.commandType === "enable" && command.status === "timeout"
  );
  const hasDisableTimeout = commands.some(
    (command) => command.commandType === "disable" && command.status === "timeout"
  );
  const hasUnacknowledgedEnable = commands.some(
    (command) => command.commandType === "enable" && command.status !== "acknowledged"
  );
  const hasUnacknowledgedDisable = commands.some(
    (command) => command.commandType === "disable" && command.status !== "acknowledged"
  );
  const stoppedByRule =
    Boolean(session.stopReason && ruleStopReasons.has(session.stopReason)) ||
    rules.some((rule) => rule.reason.startsWith("max_") || rule.reason.includes("no_load"));
  const deniedBeforeStart = rules.some((rule) => rule.result === "denied");

  let energyStatus: NonNullable<NewSessionAudit["energyStatus"]> = "normal";
  let commandStatus: NonNullable<NewSessionAudit["commandStatus"]> = "normal";
  let ruleStatus: NonNullable<NewSessionAudit["ruleStatus"]> = "normal";
  let auditStatus: NonNullable<NewSessionAudit["auditStatus"]> = "valid";
  let billingStatus: NonNullable<NewSessionAudit["billingStatus"]> = "billable";

  if ((session.status === "active" || session.status === "completed") && !hasMeterValues) {
    energyStatus = "missing_meter_values";
  } else if (session.status === "completed" && energyKwh === 0) {
    energyStatus = "zero_consumption";
  } else if (session.status === "completed" && energyKwh < MIN_BILLABLE_KWH) {
    energyStatus = "low_consumption";
  } else if (recordedMaxPowerKw > MAX_REASONABLE_POWER_KW) {
    energyStatus = "suspicious_spike";
  } else if (hasMeterMismatch) {
    energyStatus = "meter_mismatch";
  }

  if (hasEnableTimeout || hasDisableTimeout) {
    commandStatus = "command_timeout";
  } else if (hasUnacknowledgedEnable) {
    commandStatus = "missing_enable_ack";
  } else if (hasUnacknowledgedDisable) {
    commandStatus = "missing_disable_ack";
  }

  if (deniedBeforeStart) {
    ruleStatus = "denied_before_start";
  } else if (stoppedByRule) {
    ruleStatus = "stopped_by_rule";
  }

  if (session.status === "completed" && energyStatus === "normal" && commandStatus === "normal") {
    auditStatus = stoppedByRule ? "warning" : "valid";
    billingStatus = "billable";
  } else if (session.status === "completed" && energyStatus === "zero_consumption") {
    auditStatus = "warning";
    billingStatus = "not_billable";
  } else if (session.status === "failed") {
    auditStatus = "failed";
    billingStatus = "pending_review";
  } else if (session.status === "pending_start") {
    auditStatus = "needs_review";
    billingStatus = "not_billable";
  } else if (session.status === "active") {
    auditStatus = "needs_review";
    billingStatus = "pending_review";
  } else {
    auditStatus = "needs_review";
    billingStatus = "pending_review";
  }

  if (energyStatus === "missing_meter_values" || energyStatus === "meter_mismatch") {
    auditStatus = "needs_review";
    billingStatus = "pending_review";
  }

  if (energyStatus === "suspicious_spike" || commandStatus !== "normal") {
    auditStatus = "needs_review";
    billingStatus = "pending_review";
  }

  const details = {
    recordedKwh: round(energyKwh, 3),
    meterDeltaKwh: meterDeltaKwh === null ? null : round(meterDeltaKwh, 3),
    meterValues: meterRows.length,
    maxPowerKw: round(recordedMaxPowerKw, 3),
    toleranceKwh: ENERGY_DELTA_TOLERANCE_KWH,
    maxReasonablePowerKw: MAX_REASONABLE_POWER_KW,
    commandCount: commands.length,
    stopReason: session.stopReason,
    residentActive: session.residentActive,
    chargerKind: session.chargerKind
  };

  const values = {
    propertyId: session.propertyId,
    sessionId: session.id,
    residentId: session.residentId,
    apartmentId: session.apartmentId,
    outletId: session.chargerId,
    auditStatus,
    energyStatus,
    commandStatus,
    ruleStatus,
    billingStatus,
    details,
    updatedAt: new Date()
  };

  const [existing] = await db
    .select({ id: sessionAudits.id, billingStatus: sessionAudits.billingStatus })
    .from(sessionAudits)
    .where(eq(sessionAudits.sessionId, session.id))
    .limit(1);

  if (existing) {
    const shouldPreserveManualExclusion = existing.billingStatus === "excluded";
    const [updated] = await db
      .update(sessionAudits)
      .set({
        ...values,
        billingStatus: shouldPreserveManualExclusion ? "excluded" : billingStatus
      })
      .where(eq(sessionAudits.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("No se pudo actualizar la auditoría de sesión.");
    }

    return updated;
  }

  const [created] = await db.insert(sessionAudits).values(values).returning();

  if (!created) {
    throw new Error("No se pudo crear la auditoría de sesión.");
  }

  return created;
}

export async function auditSessionsForPeriod(
  db: VoltariaDb,
  propertyId: string,
  startDate: Date,
  endDate: Date
) {
  const sessions = await db
    .select({ id: chargingSessions.id })
    .from(chargingSessions)
    .where(
      and(
        eq(chargingSessions.propertyId, propertyId),
        gte(chargingSessions.startedAt, startDate),
        lt(chargingSessions.startedAt, endDate)
      )
    )
    .orderBy(chargingSessions.startedAt);

  const audits = [];

  for (const session of sessions) {
    audits.push(await auditSession(db, session.id));
  }

  return audits;
}

export async function getSessionAudit(db: VoltariaDb, sessionId: string) {
  const [audit] = await db
    .select()
    .from(sessionAudits)
    .where(eq(sessionAudits.sessionId, sessionId))
    .limit(1);

  return audit ?? null;
}

export async function getSessionsNeedingReview(db: VoltariaDb, propertyId: string) {
  return db
    .select()
    .from(sessionAudits)
    .where(
      and(
        eq(sessionAudits.propertyId, propertyId),
        eq(sessionAudits.auditStatus, "needs_review")
      )
    )
    .orderBy(desc(sessionAudits.updatedAt));
}

export async function markSessionAuditReviewed(input: {
  db: VoltariaDb;
  sessionId: string;
  reviewedBy?: string;
  notes?: string;
}) {
  const [audit] = await input.db
    .update(sessionAudits)
    .set({
      auditStatus: "valid",
      reviewedBy: input.reviewedBy ?? "admin",
      reviewedAt: new Date(),
      ...(typeof input.notes === "string" ? { notes: input.notes } : {}),
      updatedAt: new Date()
    })
    .where(eq(sessionAudits.sessionId, input.sessionId))
    .returning();

  if (!audit) {
    throw new Error("Auditoría no encontrada.");
  }

  return audit;
}

export async function excludeSessionFromBilling(input: {
  db: VoltariaDb;
  sessionId: string;
  reason: string;
}) {
  const [audit] = await input.db
    .update(sessionAudits)
    .set({
      billingStatus: "excluded",
      notes: input.reason,
      updatedAt: new Date()
    })
    .where(eq(sessionAudits.sessionId, input.sessionId))
    .returning();

  if (!audit) {
    throw new Error("Auditoría no encontrada.");
  }

  return audit;
}

export async function includeSessionInBilling(input: {
  db: VoltariaDb;
  sessionId: string;
  reason: string;
}) {
  const [audit] = await input.db
    .update(sessionAudits)
    .set({
      billingStatus: "billable",
      notes: input.reason,
      updatedAt: new Date()
    })
    .where(eq(sessionAudits.sessionId, input.sessionId))
    .returning();

  if (!audit) {
    throw new Error("Auditoría no encontrada.");
  }

  return audit;
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

function round(value: number, decimals: number) {
  return Number(value.toFixed(decimals));
}
