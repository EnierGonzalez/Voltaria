import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { VoltariaDb } from "./client";
import {
  accessScheduleWindows,
  apartmentAccessOverrides,
  apartments,
  chargers,
  chargingSessions,
  deviceCommands,
  outletAccessOverrides,
  properties,
  propertyAccessRules,
  residentAccessOverrides,
  residents,
  ruleEvaluations,
  tariffs,
  type OutletAccessOverride,
  type ResidentAccessOverride
} from "./schema";

type DbExecutor = Pick<VoltariaDb, "insert" | "select" | "update">;
type ActivationMethod = "rfid" | "mobile" | "admin";
type RuleResult = "allowed" | "denied";

const ACTIVE_SESSION_STATUSES = ["pending_start", "active"] as const;

const DEFAULT_RULE = {
  name: "Regla residencial estándar",
  active: true,
  allowRfid: true,
  allowMobile: true,
  allowAdmin: true,
  maxActiveSessionsPerResident: 1,
  maxActiveSessionsPerApartment: 2,
  maxActiveSessionsProperty: 16,
  maxSessionDurationMinutes: 480,
  maxSessionKwh: null,
  maxSessionCost: null,
  startupNoLoadTimeoutSeconds: 90,
  noLoadTimeoutSeconds: 600,
  lowPowerThresholdWatts: 20,
  overcurrentAction: "stop_session" as const,
  defaultMaxCurrentAmp: 12
};

export type RuleDecision = {
  allowed: boolean;
  reason: string;
  message: string;
  details: Record<string, unknown>;
};

export type EvaluateStartSessionInput = {
  propertyId: string;
  residentId: string;
  apartmentId: string;
  outletId: string;
  method: ActivationMethod;
  requestedAt?: Date | undefined;
  source: "mobile" | "rfid" | "admin";
};

export type RuntimeRuleSettings = {
  startupNoLoadTimeoutSeconds: number;
  noLoadTimeoutSeconds: number;
  lowPowerThresholdWatts: number;
  overcurrentAction: "alert_only" | "stop_session";
  defaultMaxCurrentAmp?: number;
  maxCurrentAmp?: number;
  maxSessionDurationMinutes?: number;
  maxSessionKwh?: number;
  maxSessionCost?: number;
};

export async function getActivePropertyRules(db: DbExecutor, propertyId: string) {
  const [rule] = await db
    .select()
    .from(propertyAccessRules)
    .where(and(eq(propertyAccessRules.propertyId, propertyId), eq(propertyAccessRules.active, true)))
    .orderBy(desc(propertyAccessRules.updatedAt))
    .limit(1);

  return rule ?? null;
}

export async function evaluateStartSession(
  db: DbExecutor,
  input: EvaluateStartSessionInput
): Promise<RuleDecision> {
  const requestedAt = input.requestedAt ?? new Date();
  const baseDetails = {
    method: input.method,
    source: input.source,
    requestedAt: requestedAt.toISOString()
  };

  const [property] = await db
    .select({ id: properties.id, timezone: properties.timezone })
    .from(properties)
    .where(eq(properties.id, input.propertyId))
    .limit(1);

  if (!property) {
    return recordDecision(db, input, "denied", "property_inactive", "Propiedad no encontrada.", baseDetails);
  }

  const rule = await getEffectivePropertyRule(db, input.propertyId);
  const ruleDetails = {
    ...baseDetails,
    ruleId: rule.id,
    ruleName: rule.name
  };

  if (!rule.active) {
    return recordDecision(db, input, "denied", "property_inactive", "La carga no está habilitada para esta propiedad.", ruleDetails);
  }

  const [outlet] = await db
    .select()
    .from(chargers)
    .where(and(eq(chargers.id, input.outletId), eq(chargers.propertyId, input.propertyId)))
    .limit(1);

  if (!outlet) {
    return recordDecision(db, input, "denied", "outlet_not_found", "No se encontró la toma solicitada.", ruleDetails);
  }

  if (outlet.kind !== "controlled_outlet") {
    return recordDecision(db, input, "denied", "outlet_not_controlled", "La toma no es controlable.", ruleDetails);
  }

  const outletOverride = await getOutletOverride(db, input.propertyId, input.outletId);
  const residentOverride = await getResidentOverride(db, input.propertyId, input.residentId);
  const apartmentOverride = await getApartmentOverride(db, input.propertyId, input.apartmentId);

  if (!isMethodAllowedByRule(rule, input.method)) {
    return recordDecision(db, input, "denied", "method_not_allowed", methodDeniedMessage(input.method), ruleDetails);
  }

  if (!isMethodAllowedByOutlet(outletOverride, input.method)) {
    return recordDecision(db, input, "denied", "method_not_allowed", methodDeniedMessage(input.method), {
      ...ruleDetails,
      outletOverrideId: outletOverride?.id
    });
  }

  if (!isMethodAllowedByResident(residentOverride, input.method)) {
    return recordDecision(db, input, "denied", "method_not_allowed", methodDeniedMessage(input.method), {
      ...ruleDetails,
      residentOverrideId: residentOverride?.id
    });
  }

  const operationalStatus = outletOverride?.status ?? "available";

  if (operationalStatus === "maintenance") {
    return recordDecision(db, input, "denied", "outlet_maintenance", "Esta toma está en mantenimiento.", {
      ...ruleDetails,
      outletOverrideId: outletOverride?.id
    });
  }

  if (operationalStatus === "disabled") {
    return recordDecision(db, input, "denied", "outlet_disabled", "Esta toma está deshabilitada.", {
      ...ruleDetails,
      outletOverrideId: outletOverride?.id
    });
  }

  if (operationalStatus === "reserved") {
    return recordDecision(db, input, "denied", "outlet_reserved", "Esta toma está reservada.", {
      ...ruleDetails,
      outletOverrideId: outletOverride?.id
    });
  }

  if (outlet.status === "faulted" || outlet.status === "offline") {
    return recordDecision(db, input, "denied", "outlet_disabled", "Esta toma está fuera de servicio.", {
      ...ruleDetails,
      outletStatus: outlet.status
    });
  }

  const [resident] = await db
    .select({
      id: residents.id,
      apartmentId: residents.apartmentId,
      isActive: residents.isActive
    })
    .from(residents)
    .where(and(eq(residents.id, input.residentId), eq(residents.propertyId, input.propertyId)))
    .limit(1);

  if (!resident || !resident.isActive) {
    return recordDecision(db, input, "denied", "resident_blocked", "Residente suspendido.", ruleDetails);
  }

  const [apartment] = await db
    .select({ id: apartments.id })
    .from(apartments)
    .where(and(eq(apartments.id, input.apartmentId), eq(apartments.propertyId, input.propertyId)))
    .limit(1);

  if (!apartment || resident.apartmentId !== input.apartmentId) {
    return recordDecision(db, input, "denied", "apartment_blocked", "Departamento suspendido o no asignado.", ruleDetails);
  }

  if (residentOverride?.status === "blocked" || residentOverride?.status === "suspended") {
    return recordDecision(db, input, "denied", "resident_blocked", "El residente está bloqueado para carga.", {
      ...ruleDetails,
      residentOverrideId: residentOverride.id,
      residentStatus: residentOverride.status
    });
  }

  if (apartmentOverride?.status === "blocked" || apartmentOverride?.status === "suspended") {
    return recordDecision(db, input, "denied", "apartment_blocked", "Tu departamento está suspendido para carga.", {
      ...ruleDetails,
      apartmentOverrideId: apartmentOverride.id,
      apartmentStatus: apartmentOverride.status
    });
  }

  const scheduleDecision = await evaluateSchedule(db, {
    propertyId: input.propertyId,
    ruleId: rule.id,
    requestedAt
  });

  if (!scheduleDecision.allowed) {
    return recordDecision(db, input, "denied", "outside_schedule", "El horario de carga no está disponible.", {
      ...ruleDetails,
      schedule: scheduleDecision.details
    });
  }

  const residentActiveCount = await countActiveSessions(db, {
    propertyId: input.propertyId,
    residentId: input.residentId
  });
  const maxResidentSessions = rule.maxActiveSessionsPerResident;

  if (residentActiveCount >= maxResidentSessions) {
    return recordDecision(db, input, "denied", "resident_session_limit", "Ya tienes una sesión activa.", {
      ...ruleDetails,
      residentActiveCount,
      maxResidentSessions
    });
  }

  const maxDailySessions = residentOverride?.maxSessionsPerDay ?? null;

  if (maxDailySessions !== null) {
    const sessionsToday = await countResidentSessionsToday(db, input.propertyId, input.residentId, requestedAt);

    if (sessionsToday >= maxDailySessions) {
      return recordDecision(db, input, "denied", "resident_daily_limit", "Alcanzaste el límite diario de sesiones.", {
        ...ruleDetails,
        sessionsToday,
        maxDailySessions
      });
    }
  }

  const apartmentActiveCount = await countActiveSessions(db, {
    propertyId: input.propertyId,
    apartmentId: input.apartmentId
  });
  const maxApartmentSessions =
    apartmentOverride?.maxActiveSessions ?? rule.maxActiveSessionsPerApartment;

  if (apartmentActiveCount >= maxApartmentSessions) {
    return recordDecision(db, input, "denied", "apartment_session_limit", "El departamento alcanzó su límite de sesiones activas.", {
      ...ruleDetails,
      apartmentActiveCount,
      maxApartmentSessions
    });
  }

  const propertyMax = rule.maxActiveSessionsProperty;

  if (propertyMax !== null) {
    const propertyActiveCount = await countActiveSessions(db, { propertyId: input.propertyId });

    if (propertyActiveCount >= propertyMax) {
      return recordDecision(db, input, "denied", "property_session_limit", "La propiedad alcanzó el límite de sesiones activas.", {
        ...ruleDetails,
        propertyActiveCount,
        propertyMax
      });
    }
  }

  const [tariff] = await db
    .select({ id: tariffs.id })
    .from(tariffs)
    .where(and(eq(tariffs.propertyId, input.propertyId), eq(tariffs.isActive, true)))
    .orderBy(desc(tariffs.validFrom))
    .limit(1);

  if (!tariff) {
    return recordDecision(db, input, "denied", "no_active_tariff", "No hay tarifa activa.", ruleDetails);
  }

  const outletActiveCount = await countActiveSessions(db, {
    propertyId: input.propertyId,
    outletId: input.outletId
  });

  if (outletActiveCount > 0 || outlet.status === "charging" || outlet.status === "reserved") {
    return recordDecision(db, input, "denied", "outlet_occupied", "Toma ocupada.", {
      ...ruleDetails,
      outletActiveCount,
      outletStatus: outlet.status
    });
  }

  const [pendingCommand] = await db
    .select({ id: deviceCommands.id })
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.chargerId, input.outletId),
        inArray(deviceCommands.status, ["pending", "sent"])
      )
    )
    .limit(1);

  if (pendingCommand) {
    return recordDecision(db, input, "denied", "pending_command_exists", "La toma tiene un comando pendiente.", {
      ...ruleDetails,
      pendingCommandId: pendingCommand.id
    });
  }

  const effectiveMaxCurrentAmp = toNumber(outletOverride?.maxCurrentAmp)
    || toNumber(outlet.maxCurrentAmp)
    || toNumber(rule.defaultMaxCurrentAmp)
    || DEFAULT_RULE.defaultMaxCurrentAmp;
  const voltage = outlet.voltage ?? 120;

  if (voltage <= 0 || effectiveMaxCurrentAmp <= 0) {
    return recordDecision(db, input, "denied", "invalid_electrical_limits", "La toma no tiene parámetros eléctricos válidos.", {
      ...ruleDetails,
      voltage,
      effectiveMaxCurrentAmp
    });
  }

  return recordDecision(db, input, "allowed", "allowed", "Carga permitida.", {
    ...ruleDetails,
    tariffId: tariff.id,
    effectiveMaxCurrentAmp,
    maxSessionDurationMinutes:
      residentOverride?.maxSessionDurationMinutes
      ?? outletOverride?.maxSessionDurationMinutes
      ?? rule.maxSessionDurationMinutes,
    maxSessionKwh: residentOverride?.maxSessionKwh ?? rule.maxSessionKwh,
    maxSessionCost: rule.maxSessionCost
  });
}

export async function evaluateStopSession(
  db: DbExecutor,
  input: {
    propertyId: string;
    residentId?: string | undefined;
    apartmentId?: string | undefined;
    outletId?: string | undefined;
    sessionId: string;
    method: ActivationMethod;
    requestedAt?: Date | undefined;
  }
): Promise<RuleDecision> {
  return recordRuleEvaluation(db, {
    propertyId: input.propertyId,
    residentId: input.residentId,
    apartmentId: input.apartmentId,
    outletId: input.outletId,
    sessionId: input.sessionId,
    method: input.method,
    result: "allowed",
    reason: "stop_allowed",
    details: {
      requestedAt: (input.requestedAt ?? new Date()).toISOString()
    }
  });
}

export async function evaluateOutletAvailability(
  db: DbExecutor,
  input: { propertyId: string; outletId: string; method?: ActivationMethod | undefined }
): Promise<RuleDecision> {
  const [outlet] = await db
    .select()
    .from(chargers)
    .where(and(eq(chargers.id, input.outletId), eq(chargers.propertyId, input.propertyId)))
    .limit(1);

  if (!outlet || outlet.kind !== "controlled_outlet") {
    return simpleDecision(false, "outlet_not_found", "No se encontró la toma controlada.");
  }

  const override = await getOutletOverride(db, input.propertyId, input.outletId);

  if (override?.status === "maintenance") {
    return simpleDecision(false, "outlet_maintenance", "Esta toma está en mantenimiento.");
  }

  if (override?.status === "disabled") {
    return simpleDecision(false, "outlet_disabled", "Esta toma está deshabilitada.");
  }

  if (input.method && !isMethodAllowedByOutlet(override, input.method)) {
    return simpleDecision(false, "method_not_allowed", methodDeniedMessage(input.method));
  }

  return simpleDecision(true, "allowed", "Toma disponible.");
}

export async function evaluateResidentAccess(
  db: DbExecutor,
  input: { propertyId: string; residentId: string; method?: ActivationMethod | undefined }
): Promise<RuleDecision> {
  const override = await getResidentOverride(db, input.propertyId, input.residentId);

  if (override?.status === "blocked" || override?.status === "suspended") {
    return simpleDecision(false, "resident_blocked", "El residente está bloqueado para carga.");
  }

  if (input.method && !isMethodAllowedByResident(override, input.method)) {
    return simpleDecision(false, "method_not_allowed", methodDeniedMessage(input.method));
  }

  return simpleDecision(true, "allowed", "Residente permitido.");
}

export async function evaluateSchedule(
  db: DbExecutor,
  input: { propertyId: string; ruleId?: string | undefined; requestedAt?: Date | undefined }
): Promise<RuleDecision> {
  const requestedAt = input.requestedAt ?? new Date();
  const conditions = [
    eq(accessScheduleWindows.propertyId, input.propertyId),
    eq(accessScheduleWindows.active, true),
    input.ruleId ? eq(accessScheduleWindows.ruleId, input.ruleId) : undefined
  ].filter(Boolean);
  const windows = await db
    .select()
    .from(accessScheduleWindows)
    .where(and(...conditions))
    .orderBy(accessScheduleWindows.dayOfWeek, accessScheduleWindows.startTime);

  if (windows.length === 0) {
    return simpleDecision(true, "allowed", "Horario 24/7.", { schedule: "24/7" });
  }

  const dayOfWeek = requestedAt.getDay();
  const minute = requestedAt.getHours() * 60 + requestedAt.getMinutes();
  const window = windows.find((item) => {
    if (item.dayOfWeek !== dayOfWeek) {
      return false;
    }

    return isMinuteInsideWindow(minute, item.startTime, item.endTime);
  });

  if (!window) {
    return simpleDecision(false, "outside_schedule", "El horario de carga no está disponible.", {
      dayOfWeek,
      minute
    });
  }

  return simpleDecision(true, "allowed", "Horario permitido.", {
    dayOfWeek,
    startTime: window.startTime,
    endTime: window.endTime
  });
}

export async function getRuntimeRuleSettings(
  db: DbExecutor,
  propertyId: string,
  outletId?: string | undefined
): Promise<RuntimeRuleSettings> {
  const rule = await getEffectivePropertyRule(db, propertyId);
  const outletOverride = outletId ? await getOutletOverride(db, propertyId, outletId) : null;
  const settings: RuntimeRuleSettings = {
    startupNoLoadTimeoutSeconds: rule.startupNoLoadTimeoutSeconds,
    noLoadTimeoutSeconds: rule.noLoadTimeoutSeconds,
    lowPowerThresholdWatts: rule.lowPowerThresholdWatts,
    overcurrentAction: rule.overcurrentAction
  };

  if (rule.defaultMaxCurrentAmp !== null) {
    settings.defaultMaxCurrentAmp = rule.defaultMaxCurrentAmp;
  }

  if (outletOverride?.maxCurrentAmp) {
    settings.maxCurrentAmp = toNumber(outletOverride.maxCurrentAmp);
  }

  const maxSessionDurationMinutes =
    outletOverride?.maxSessionDurationMinutes ?? rule.maxSessionDurationMinutes;

  if (maxSessionDurationMinutes !== null && typeof maxSessionDurationMinutes !== "undefined") {
    settings.maxSessionDurationMinutes = maxSessionDurationMinutes;
  }

  if (rule.maxSessionKwh !== null) {
    settings.maxSessionKwh = rule.maxSessionKwh;
  }

  if (rule.maxSessionCost !== null) {
    settings.maxSessionCost = rule.maxSessionCost;
  }

  return settings;
}

export async function recordRuleEvaluation(
  db: DbExecutor,
  input: {
    propertyId: string;
    residentId?: string | undefined;
    apartmentId?: string | undefined;
    outletId?: string | undefined;
    sessionId?: string | undefined;
    method: ActivationMethod;
    result: RuleResult;
    reason: string;
    details?: Record<string, unknown> | undefined;
  }
): Promise<RuleDecision> {
  await db.insert(ruleEvaluations).values({
    propertyId: input.propertyId,
    residentId: input.residentId,
    apartmentId: input.apartmentId,
    outletId: input.outletId,
    sessionId: input.sessionId,
    method: input.method,
    result: input.result,
    reason: input.reason,
    details: input.details ?? {}
  });

  return {
    allowed: input.result === "allowed",
    reason: input.reason,
    message: messageForReason(input.reason),
    details: input.details ?? {}
  };
}

export async function updatePropertyAccessRule(
  db: VoltariaDb,
  input: {
    ruleId: string;
    name: string;
    active: boolean;
    allowRfid: boolean;
    allowMobile: boolean;
    allowAdmin: boolean;
    maxActiveSessionsPerResident: number;
    maxActiveSessionsPerApartment: number;
    maxActiveSessionsProperty?: number | undefined;
    maxSessionDurationMinutes?: number | undefined;
    maxSessionKwh?: number | undefined;
    maxSessionCost?: number | undefined;
    startupNoLoadTimeoutSeconds: number;
    noLoadTimeoutSeconds: number;
    lowPowerThresholdWatts: number;
    overcurrentAction: "alert_only" | "stop_session";
    defaultMaxCurrentAmp?: number | undefined;
    scheduleStartTime: string;
    scheduleEndTime: string;
  }
) {
  return db.transaction(async (tx) => {
    const [rule] = await tx
      .update(propertyAccessRules)
      .set({
        name: input.name,
        active: input.active,
        allowRfid: input.allowRfid,
        allowMobile: input.allowMobile,
        allowAdmin: input.allowAdmin,
        maxActiveSessionsPerResident: input.maxActiveSessionsPerResident,
        maxActiveSessionsPerApartment: input.maxActiveSessionsPerApartment,
        maxActiveSessionsProperty: input.maxActiveSessionsProperty ?? null,
        maxSessionDurationMinutes: input.maxSessionDurationMinutes ?? null,
        maxSessionKwh: input.maxSessionKwh?.toFixed(3) ?? null,
        maxSessionCost: input.maxSessionCost?.toFixed(2) ?? null,
        startupNoLoadTimeoutSeconds: input.startupNoLoadTimeoutSeconds,
        noLoadTimeoutSeconds: input.noLoadTimeoutSeconds,
        lowPowerThresholdWatts: input.lowPowerThresholdWatts.toFixed(2),
        overcurrentAction: input.overcurrentAction,
        defaultMaxCurrentAmp: input.defaultMaxCurrentAmp?.toFixed(2) ?? null,
        updatedAt: new Date()
      })
      .where(eq(propertyAccessRules.id, input.ruleId))
      .returning();

    if (!rule) {
      return { ok: false, error: "No se encontró la regla operativa." } as const;
    }

    const existingWindows = await tx
      .select()
      .from(accessScheduleWindows)
      .where(eq(accessScheduleWindows.ruleId, rule.id));
    const usedIds = new Set<string>();

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      const existing = existingWindows.find((window) => window.dayOfWeek === dayOfWeek && !usedIds.has(window.id));

      if (existing) {
        usedIds.add(existing.id);
        await tx
          .update(accessScheduleWindows)
          .set({
            startTime: input.scheduleStartTime,
            endTime: input.scheduleEndTime,
            active: true,
            updatedAt: new Date()
          })
          .where(eq(accessScheduleWindows.id, existing.id));
        continue;
      }

      const [created] = await tx
        .insert(accessScheduleWindows)
        .values({
          propertyId: rule.propertyId,
          ruleId: rule.id,
          dayOfWeek,
          startTime: input.scheduleStartTime,
          endTime: input.scheduleEndTime,
          active: true
        })
        .returning({ id: accessScheduleWindows.id });

      if (created) {
        usedIds.add(created.id);
      }
    }

    for (const window of existingWindows) {
      if (!usedIds.has(window.id)) {
        await tx
          .update(accessScheduleWindows)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(accessScheduleWindows.id, window.id));
      }
    }

    return { ok: true, message: "Reglas operativas actualizadas." } as const;
  });
}

export async function setOutletAccessOverride(
  db: VoltariaDb,
  input: {
    outletId: string;
    status: "available" | "maintenance" | "disabled" | "reserved";
    allowRfid?: boolean | undefined;
    allowMobile?: boolean | undefined;
    maxCurrentAmp?: number | undefined;
    maxSessionDurationMinutes?: number | undefined;
    notes?: string | undefined;
  }
) {
  const [outlet] = await db
    .select({ id: chargers.id, propertyId: chargers.propertyId })
    .from(chargers)
    .where(and(eq(chargers.id, input.outletId), eq(chargers.kind, "controlled_outlet")))
    .limit(1);

  if (!outlet) {
    return { ok: false, error: "No se encontró la toma controlada." } as const;
  }

  const values = {
    propertyId: outlet.propertyId,
    outletId: outlet.id,
    status: input.status,
    allowRfid: input.allowRfid,
    allowMobile: input.allowMobile,
    maxCurrentAmp: input.maxCurrentAmp?.toFixed(2),
    maxSessionDurationMinutes: input.maxSessionDurationMinutes,
    notes: input.notes,
    updatedAt: new Date()
  };
  const [existing] = await db
    .select({ id: outletAccessOverrides.id })
    .from(outletAccessOverrides)
    .where(
      and(
        eq(outletAccessOverrides.propertyId, outlet.propertyId),
        eq(outletAccessOverrides.outletId, outlet.id)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(outletAccessOverrides)
      .set(values)
      .where(eq(outletAccessOverrides.id, existing.id));
  } else {
    await db.insert(outletAccessOverrides).values(values);
  }

  return { ok: true, message: "Estado operativo de toma actualizado." } as const;
}

export async function setResidentAccessOverride(
  db: VoltariaDb,
  input: {
    residentId: string;
    status: "allowed" | "blocked" | "suspended" | "limited";
    allowRfid?: boolean | undefined;
    allowMobile?: boolean | undefined;
    maxSessionDurationMinutes?: number | undefined;
    maxSessionKwh?: number | undefined;
    maxSessionsPerDay?: number | undefined;
    notes?: string | undefined;
  }
) {
  const [resident] = await db
    .select({ id: residents.id, propertyId: residents.propertyId })
    .from(residents)
    .where(eq(residents.id, input.residentId))
    .limit(1);

  if (!resident) {
    return { ok: false, error: "No se encontró el residente." } as const;
  }

  const values = {
    propertyId: resident.propertyId,
    residentId: resident.id,
    status: input.status,
    allowRfid: input.allowRfid,
    allowMobile: input.allowMobile,
    maxSessionDurationMinutes: input.maxSessionDurationMinutes,
    maxSessionKwh: input.maxSessionKwh?.toFixed(3),
    maxSessionsPerDay: input.maxSessionsPerDay,
    notes: input.notes,
    updatedAt: new Date()
  };
  const [existing] = await db
    .select({ id: residentAccessOverrides.id })
    .from(residentAccessOverrides)
    .where(
      and(
        eq(residentAccessOverrides.propertyId, resident.propertyId),
        eq(residentAccessOverrides.residentId, resident.id)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(residentAccessOverrides)
      .set(values)
      .where(eq(residentAccessOverrides.id, existing.id));
  } else {
    await db.insert(residentAccessOverrides).values(values);
  }

  return { ok: true, message: "Reglas de acceso del residente actualizadas." } as const;
}

async function recordDecision(
  db: DbExecutor,
  input: EvaluateStartSessionInput,
  result: RuleResult,
  reason: string,
  message: string,
  details: Record<string, unknown>
): Promise<RuleDecision> {
  await db.insert(ruleEvaluations).values({
    propertyId: input.propertyId,
    residentId: input.residentId,
    apartmentId: input.apartmentId,
    outletId: input.outletId,
    method: input.method,
    result,
    reason,
    details
  });

  return {
    allowed: result === "allowed",
    reason,
    message,
    details
  };
}

async function getEffectivePropertyRule(db: DbExecutor, propertyId: string) {
  const rule = await getActivePropertyRules(db, propertyId);

  if (!rule) {
    return {
      id: undefined,
      propertyId,
      ...DEFAULT_RULE
    };
  }

  return {
    id: rule.id,
    propertyId: rule.propertyId,
    name: rule.name,
    active: rule.active,
    allowRfid: rule.allowRfid,
    allowMobile: rule.allowMobile,
    allowAdmin: rule.allowAdmin,
    maxActiveSessionsPerResident: rule.maxActiveSessionsPerResident,
    maxActiveSessionsPerApartment: rule.maxActiveSessionsPerApartment,
    maxActiveSessionsProperty: rule.maxActiveSessionsProperty,
    maxSessionDurationMinutes: rule.maxSessionDurationMinutes,
    maxSessionKwh: nullableNumber(rule.maxSessionKwh),
    maxSessionCost: nullableNumber(rule.maxSessionCost),
    startupNoLoadTimeoutSeconds: rule.startupNoLoadTimeoutSeconds,
    noLoadTimeoutSeconds: rule.noLoadTimeoutSeconds,
    lowPowerThresholdWatts: toNumber(rule.lowPowerThresholdWatts) || DEFAULT_RULE.lowPowerThresholdWatts,
    overcurrentAction: rule.overcurrentAction,
    defaultMaxCurrentAmp: nullableNumber(rule.defaultMaxCurrentAmp)
  };
}

async function getOutletOverride(db: DbExecutor, propertyId: string, outletId: string) {
  const [override] = await db
    .select()
    .from(outletAccessOverrides)
    .where(and(eq(outletAccessOverrides.propertyId, propertyId), eq(outletAccessOverrides.outletId, outletId)))
    .limit(1);

  return override ?? null;
}

async function getResidentOverride(db: DbExecutor, propertyId: string, residentId: string) {
  const [override] = await db
    .select()
    .from(residentAccessOverrides)
    .where(
      and(
        eq(residentAccessOverrides.propertyId, propertyId),
        eq(residentAccessOverrides.residentId, residentId)
      )
    )
    .limit(1);

  return override ?? null;
}

async function getApartmentOverride(db: DbExecutor, propertyId: string, apartmentId: string) {
  const [override] = await db
    .select()
    .from(apartmentAccessOverrides)
    .where(
      and(
        eq(apartmentAccessOverrides.propertyId, propertyId),
        eq(apartmentAccessOverrides.apartmentId, apartmentId)
      )
    )
    .limit(1);

  return override ?? null;
}

async function countActiveSessions(
  db: DbExecutor,
  input: {
    propertyId: string;
    residentId?: string | undefined;
    apartmentId?: string | undefined;
    outletId?: string | undefined;
  }
) {
  const conditions = [
    eq(chargingSessions.propertyId, input.propertyId),
    inArray(chargingSessions.status, ACTIVE_SESSION_STATUSES),
    input.residentId ? eq(chargingSessions.residentId, input.residentId) : undefined,
    input.apartmentId ? eq(chargingSessions.apartmentId, input.apartmentId) : undefined,
    input.outletId ? eq(chargingSessions.chargerId, input.outletId) : undefined
  ].filter(Boolean);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chargingSessions)
    .where(and(...conditions));

  return row?.count ?? 0;
}

async function countResidentSessionsToday(
  db: DbExecutor,
  propertyId: string,
  residentId: string,
  requestedAt: Date
) {
  const dayStart = new Date(requestedAt);
  dayStart.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chargingSessions)
    .where(
      and(
        eq(chargingSessions.propertyId, propertyId),
        eq(chargingSessions.residentId, residentId),
        gte(chargingSessions.startedAt, dayStart)
      )
    );

  return row?.count ?? 0;
}

function isMethodAllowedByRule(rule: Awaited<ReturnType<typeof getEffectivePropertyRule>>, method: ActivationMethod) {
  if (method === "rfid") {
    return rule.allowRfid;
  }

  if (method === "mobile") {
    return rule.allowMobile;
  }

  return rule.allowAdmin;
}

function isMethodAllowedByOutlet(override: OutletAccessOverride | null, method: ActivationMethod) {
  if (!override) {
    return true;
  }

  if (method === "rfid" && override.allowRfid === false) {
    return false;
  }

  if (method === "mobile" && override.allowMobile === false) {
    return false;
  }

  return true;
}

function isMethodAllowedByResident(override: ResidentAccessOverride | null, method: ActivationMethod) {
  if (!override) {
    return true;
  }

  if (method === "rfid" && override.allowRfid === false) {
    return false;
  }

  if (method === "mobile" && override.allowMobile === false) {
    return false;
  }

  return true;
}

function methodDeniedMessage(method: ActivationMethod) {
  if (method === "mobile") {
    return "La carga por app no está habilitada.";
  }

  if (method === "rfid") {
    return "La carga por RFID no está habilitada.";
  }

  return "La carga por administración no está habilitada.";
}

function simpleDecision(
  allowed: boolean,
  reason: string,
  message: string,
  details: Record<string, unknown> = {}
): RuleDecision {
  return { allowed, reason, message, details };
}

function messageForReason(reason: string) {
  const messages: Record<string, string> = {
    stop_allowed: "Detención permitida.",
    allowed: "Carga permitida.",
    method_not_allowed: "Método no permitido.",
    outside_schedule: "El horario de carga no está disponible.",
    resident_blocked: "El residente está bloqueado para carga.",
    apartment_blocked: "El departamento está suspendido para carga.",
    outlet_disabled: "Esta toma está deshabilitada.",
    outlet_maintenance: "Esta toma está en mantenimiento.",
    outlet_occupied: "Toma ocupada.",
    resident_session_limit: "Ya tienes una sesión activa.",
    apartment_session_limit: "El departamento alcanzó su límite de sesiones activas.",
    property_session_limit: "La propiedad alcanzó el límite de sesiones activas.",
    no_active_tariff: "No hay tarifa activa.",
    pending_command_exists: "La toma tiene un comando pendiente."
  };

  return messages[reason] ?? "Decisión de reglas registrada.";
}

function isMinuteInsideWindow(minute: number, startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start <= end) {
    return minute >= start && minute <= end;
  }

  return minute >= start || minute <= end;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return (hours || 0) * 60 + (minutes || 0);
}

function nullableNumber(value: unknown) {
  const number = toNumber(value);
  return number > 0 ? number : null;
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
