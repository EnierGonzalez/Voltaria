import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import type { VoltariaDb } from "./client";
import {
  evaluateOutletAvailability,
  evaluateStartSession,
  getRuntimeRuleSettings,
  recordRuleEvaluation
} from "./rules-engine";
import {
  alerts,
  apartments,
  chargerConnectors,
  chargers,
  chargingSessions,
  deviceCommands,
  meterValues,
  properties,
  residents,
  systemEvents,
  tariffs
} from "./schema";

type DbExecutor = Pick<VoltariaDb, "insert" | "select" | "update">;

const DEMO_RESIDENT_EMAIL = "maria.lopez@example.com";
const ACTIVE_SESSION_STATUSES = ["pending_start", "active"] as const;

export type RuntimeResult =
  | {
      ok: true;
      message: string;
      sessionId?: string;
      commandId?: string;
    }
  | {
      ok: false;
      error: string;
    };

export type RuntimeResident = {
  id: string;
  propertyId: string;
  apartmentId: string | null;
  fullName: string;
  email: string;
  isActive: boolean;
  apartmentNumber: string | null;
};

export type OutletSimulatorTickResult = {
  processedCommands: number;
  meterValues: number;
  timedOutSessions: number;
  noLoadSessions: number;
  overCurrentSessions: number;
  ruleStoppedSessions: number;
};

export async function getCurrentDemoResident(db: DbExecutor): Promise<RuntimeResident | null> {
  // TODO: replace this with the authenticated resident once auth is wired.
  const property = await getRuntimeProperty(db);

  if (!property) {
    return null;
  }

  const [resident] = await db
    .select({
      id: residents.id,
      propertyId: residents.propertyId,
      apartmentId: residents.apartmentId,
      fullName: residents.fullName,
      email: residents.email,
      isActive: residents.isActive,
      apartmentNumber: apartments.number
    })
    .from(residents)
    .leftJoin(apartments, eq(apartments.id, residents.apartmentId))
    .where(and(eq(residents.propertyId, property.id), eq(residents.email, DEMO_RESIDENT_EMAIL)))
    .limit(1);

  return resident ?? null;
}

export async function getRuntimeResidentById(
  db: DbExecutor,
  residentId: string
): Promise<RuntimeResident | null> {
  const [resident] = await db
    .select({
      id: residents.id,
      propertyId: residents.propertyId,
      apartmentId: residents.apartmentId,
      fullName: residents.fullName,
      email: residents.email,
      isActive: residents.isActive,
      apartmentNumber: apartments.number
    })
    .from(residents)
    .leftJoin(apartments, eq(apartments.id, residents.apartmentId))
    .where(eq(residents.id, residentId))
    .limit(1);

  return resident ?? null;
}

export async function startMobileOutletSession(
  db: VoltariaDb,
  publicAccessCode: string,
  options: { residentId?: string } = {}
): Promise<RuntimeResult> {
  return db.transaction(async (tx) => {
    const resident = options.residentId
      ? await getRuntimeResidentById(tx, options.residentId)
      : await getCurrentDemoResident(tx);

    if (!resident) {
      return { ok: false, error: "No se encontró el residente demo." };
    }

    if (!resident.isActive) {
      return { ok: false, error: "El residente no tiene acceso activo." };
    }

    if (!resident.apartmentId) {
      return { ok: false, error: "El residente no tiene departamento activo." };
    }

    const [outlet] = await tx
      .select()
      .from(chargers)
      .where(
        and(
          eq(chargers.publicAccessCode, publicAccessCode),
          eq(chargers.kind, "controlled_outlet")
        )
      )
      .limit(1);

    if (!outlet) {
      return { ok: false, error: "No se encontró la toma solicitada." };
    }

    const voltage = outlet.voltage ?? 120;
    const maxCurrentAmp = toNumber(outlet.maxCurrentAmp) || 12;

    if (voltage <= 0 || maxCurrentAmp <= 0) {
      return { ok: false, error: "La toma no tiene parámetros eléctricos válidos." };
    }

    const ruleDecision = await evaluateStartSession(tx, {
      propertyId: outlet.propertyId,
      residentId: resident.id,
      apartmentId: resident.apartmentId,
      outletId: outlet.id,
      method: "mobile",
      source: "mobile"
    });

    if (!ruleDecision.allowed) {
      return { ok: false, error: ruleDecision.message };
    }

    const effectiveMaxCurrentAmp =
      toNumber(ruleDecision.details.effectiveMaxCurrentAmp) || maxCurrentAmp;

    const [residentActiveSession] = await tx
      .select({ id: chargingSessions.id })
      .from(chargingSessions)
      .where(
        and(
          eq(chargingSessions.residentId, resident.id),
          inArray(chargingSessions.status, ACTIVE_SESSION_STATUSES)
        )
      )
      .limit(1);

    if (residentActiveSession) {
      return { ok: false, error: "Ya tienes una sesión activa o en proceso de inicio." };
    }

    const [outletActiveSession] = await tx
      .select({ id: chargingSessions.id })
      .from(chargingSessions)
      .where(
        and(
          eq(chargingSessions.chargerId, outlet.id),
          inArray(chargingSessions.status, ACTIVE_SESSION_STATUSES)
        )
      )
      .limit(1);

    if (outletActiveSession) {
      return { ok: false, error: "La toma ya tiene una sesión activa." };
    }

    const [tariff] = await tx
      .select()
      .from(tariffs)
      .where(and(eq(tariffs.propertyId, outlet.propertyId), eq(tariffs.isActive, true)))
      .orderBy(desc(tariffs.validFrom))
      .limit(1);

    if (!tariff) {
      return { ok: false, error: "No hay una tarifa activa configurada." };
    }

    const [connector] = await tx
      .select()
      .from(chargerConnectors)
      .where(eq(chargerConnectors.chargerId, outlet.id))
      .orderBy(asc(chargerConnectors.connectorNumber))
      .limit(1);

    const meterStartWh = await getLatestOutletEnergyWh(tx, outlet.id);
    const now = new Date();
    const [session] = await tx
      .insert(chargingSessions)
      .values({
        propertyId: outlet.propertyId,
        chargerId: outlet.id,
        connectorId: connector?.id,
        residentId: resident.id,
        apartmentId: resident.apartmentId,
        activationMethod: "mobile",
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
      return { ok: false, error: "No se pudo crear la sesión." };
    }

    const [command] = await tx
      .insert(deviceCommands)
      .values({
        propertyId: outlet.propertyId,
        chargerId: outlet.id,
        sessionId: session.id,
        commandType: "enable",
        status: "pending",
        payload: {
          outletId: outlet.id,
          publicAccessCode,
          sessionId: session.id,
          requestedMethod: "mobile",
          voltage,
          maxCurrentAmp: effectiveMaxCurrentAmp,
          tariffRatePerKwh: toNumber(tariff.ratePerKwh)
        },
        requestedBy: `resident:${resident.id}`
      })
      .returning();

    await tx.insert(systemEvents).values({
      propertyId: outlet.propertyId,
      chargerId: outlet.id,
      sessionId: session.id,
      severity: "info",
      eventType: "outlet_session_start_requested",
      message: `${resident.fullName} solicitó iniciar carga en ${outlet.ocppIdentity}.`,
      metadata: {
        activationMethod: "mobile",
        commandId: command?.id
      },
      occurredAt: now
    });

    return {
      ok: true,
      message: "Sesión creada en espera de confirmación del simulador.",
      sessionId: session.id,
      ...(command ? { commandId: command.id } : {})
    };
  });
}

export async function requestStopOutletSession(
  db: VoltariaDb,
  sessionId: string,
  options: { requestedBy: "mobile" | "admin"; requireDemoResident?: boolean; residentId?: string }
): Promise<RuntimeResult> {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select({
        id: chargingSessions.id,
        propertyId: chargingSessions.propertyId,
        chargerId: chargingSessions.chargerId,
        residentId: chargingSessions.residentId,
        status: chargingSessions.status,
        residentEmail: residents.email,
        outletCode: chargers.ocppIdentity,
        outletKind: chargers.kind
      })
      .from(chargingSessions)
      .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
      .leftJoin(residents, eq(residents.id, chargingSessions.residentId))
      .where(eq(chargingSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return { ok: false, error: "No se encontró la sesión." };
    }

    if (session.outletKind !== "controlled_outlet") {
      return { ok: false, error: "La sesión no pertenece a una toma controlada." };
    }

    if (session.status !== "active" && session.status !== "pending_start") {
      return { ok: false, error: "La sesión no está activa ni en proceso de inicio." };
    }

    if (options.residentId && session.residentId !== options.residentId) {
      return { ok: false, error: "No puedes detener una sesión de otro residente." };
    }

    if (options.requireDemoResident && session.residentEmail !== DEMO_RESIDENT_EMAIL) {
      return { ok: false, error: "No puedes detener una sesión de otro residente." };
    }

    const [existingCommand] = await tx
      .select({ id: deviceCommands.id })
      .from(deviceCommands)
      .where(
        and(
          eq(deviceCommands.sessionId, session.id),
          eq(deviceCommands.commandType, "disable"),
          inArray(deviceCommands.status, ["pending", "sent"])
        )
      )
      .limit(1);

    if (existingCommand) {
      return {
        ok: true,
        message: "Ya existe un comando de apagado pendiente.",
        sessionId: session.id,
        commandId: existingCommand.id
      };
    }

    const [command] = await tx
      .insert(deviceCommands)
      .values({
        propertyId: session.propertyId,
        chargerId: session.chargerId,
        sessionId: session.id,
        commandType: "disable",
        status: "pending",
        payload: {
          outletId: session.chargerId,
          sessionId: session.id,
          requestedMethod: options.requestedBy
        },
        requestedBy:
          options.requestedBy === "admin" ? "admin:demo" : `resident:${session.residentId ?? "demo"}`
      })
      .returning();

    await tx.insert(systemEvents).values({
      propertyId: session.propertyId,
      chargerId: session.chargerId,
      sessionId: session.id,
      severity: "info",
      eventType: "outlet_session_stop_requested",
      message: `Se solicitó detener la sesión en ${session.outletCode}.`,
      metadata: {
        requestedBy: options.requestedBy,
        commandId: command?.id
      },
      occurredAt: new Date()
    });

    return {
      ok: true,
      message: "Comando de apagado creado. El simulador cerrará la sesión.",
      sessionId: session.id,
      ...(command ? { commandId: command.id } : {})
    };
  });
}

export async function adminDisableOutlet(db: VoltariaDb, outletId: string): Promise<RuntimeResult> {
  const activeSession = await getActiveSessionForOutlet(db, outletId);

  if (activeSession) {
    return requestStopOutletSession(db, activeSession.id, { requestedBy: "admin" });
  }

  return createAdminOutletCommand(db, outletId, "disable");
}

export async function adminEnableOutlet(db: VoltariaDb, outletId: string): Promise<RuntimeResult> {
  return createAdminOutletCommand(db, outletId, "enable");
}

export async function runOutletSimulatorTick(db: VoltariaDb): Promise<OutletSimulatorTickResult> {
  const processedCommands = await pollPendingCommands(db);
  const meterValuesCount = await generateMeterValuesForActiveSessions(db);
  const timedOutSessions = await detectPendingStartTimeouts(db);
  const ruleStoppedSessions = await detectRuleLimitSessions(db);
  const noLoadSessions = await detectNoLoadSessions(db);
  const overCurrentSessions = await detectOverCurrentSessions(db);

  return {
    processedCommands,
    meterValues: meterValuesCount,
    timedOutSessions,
    noLoadSessions,
    overCurrentSessions,
    ruleStoppedSessions
  };
}

export async function pollPendingCommands(db: VoltariaDb) {
  const commands = await db
    .select()
    .from(deviceCommands)
    .where(eq(deviceCommands.status, "pending"))
    .orderBy(asc(deviceCommands.createdAt))
    .limit(25);

  let processed = 0;

  for (const command of commands) {
    if (command.commandType === "enable") {
      await processEnableCommand(db, command.id);
      processed += 1;
      continue;
    }

    if (command.commandType === "disable") {
      await processDisableCommand(db, command.id, "completed");
      processed += 1;
      continue;
    }

    await db
      .update(deviceCommands)
      .set({ status: "acknowledged", acknowledgedAt: new Date(), updatedAt: new Date() })
      .where(eq(deviceCommands.id, command.id));
    processed += 1;
  }

  return processed;
}

export async function processEnableCommand(db: VoltariaDb, commandId: string) {
  await db.transaction(async (tx) => {
    const [command] = await tx
      .select()
      .from(deviceCommands)
      .where(eq(deviceCommands.id, commandId))
      .limit(1);

    if (!command || command.status !== "pending") {
      return;
    }

    await tx
      .update(deviceCommands)
      .set({ status: "sent", updatedAt: new Date() })
      .where(eq(deviceCommands.id, command.id));

    const now = new Date();

    if (command.sessionId) {
      await tx
        .update(chargingSessions)
        .set({ status: "active", updatedAt: now })
        .where(eq(chargingSessions.id, command.sessionId));
    }

    if (command.chargerId) {
      await tx
        .update(chargers)
        .set({ status: "charging", lastHeartbeatAt: now, updatedAt: now })
        .where(eq(chargers.id, command.chargerId));
    }

    await tx
      .update(deviceCommands)
      .set({ status: "acknowledged", acknowledgedAt: now, updatedAt: now })
      .where(eq(deviceCommands.id, command.id));

    await tx.insert(systemEvents).values({
      propertyId: command.propertyId,
      chargerId: command.chargerId,
      sessionId: command.sessionId,
      severity: "info",
      eventType: "outlet_enable_acknowledged",
      message: "El simulador confirmó energizar la toma.",
      metadata: { commandId: command.id, simulator: true },
      occurredAt: now
    });
  });
}

export async function processDisableCommand(
  db: VoltariaDb,
  commandId: string,
  finalStatus: "completed" | "failed" | "interrupted"
) {
  await db.transaction(async (tx) => {
    const [command] = await tx
      .select()
      .from(deviceCommands)
      .where(eq(deviceCommands.id, commandId))
      .limit(1);

    if (!command || (command.status !== "pending" && command.status !== "sent")) {
      return;
    }

    await tx
      .update(deviceCommands)
      .set({ status: "sent", updatedAt: new Date() })
      .where(eq(deviceCommands.id, command.id));

    const now = new Date();
    const stopReason = getPayloadReason(command.payload, "simulator_disable_ack");

    if (command.sessionId) {
      await closeSession(tx, command.sessionId, finalStatus, stopReason, now);
    }

    if (command.chargerId) {
      await tx
        .update(chargers)
        .set({ status: "available", lastHeartbeatAt: now, updatedAt: now })
        .where(eq(chargers.id, command.chargerId));
    }

    await tx
      .update(deviceCommands)
      .set({ status: "acknowledged", acknowledgedAt: now, updatedAt: now })
      .where(eq(deviceCommands.id, command.id));

    await tx.insert(systemEvents).values({
      propertyId: command.propertyId,
      chargerId: command.chargerId,
      sessionId: command.sessionId,
      severity: "info",
      eventType: "outlet_disable_acknowledged",
      message: "El simulador confirmó apagar la toma.",
      metadata: { commandId: command.id, simulator: true, finalStatus },
      occurredAt: now
    });
  });
}

export async function generateMeterValuesForActiveSessions(db: VoltariaDb) {
  const activeSessions = await db
    .select({
      id: chargingSessions.id,
      propertyId: chargingSessions.propertyId,
      chargerId: chargingSessions.chargerId,
      connectorId: chargingSessions.connectorId,
      meterStartWh: chargingSessions.meterStartWh,
      startedAt: chargingSessions.startedAt,
      energyKwh: chargingSessions.energyKwh,
      peakPowerKw: chargingSessions.peakPowerKw,
      ratePerKwh: tariffs.ratePerKwh,
      voltage: chargers.voltage,
      maxCurrentAmp: chargers.maxCurrentAmp,
      outletCode: chargers.ocppIdentity
    })
    .from(chargingSessions)
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .leftJoin(tariffs, and(eq(tariffs.propertyId, chargingSessions.propertyId), eq(tariffs.isActive, true)))
    .where(and(eq(chargers.kind, "controlled_outlet"), eq(chargingSessions.status, "active")));

  let inserted = 0;

  for (const session of activeSessions) {
    const latest = await getLatestSessionMeterValue(db, session.id);
    const now = new Date();

    if (latest && now.getTime() - latest.sampledAt.getTime() < 10_000) {
      continue;
    }

    const seconds = latest
      ? Math.max(1, Math.round((now.getTime() - latest.sampledAt.getTime()) / 1000))
      : 15;
    const settings = await getRuntimeRuleSettings(db, session.propertyId, session.chargerId);
    const voltage = simulateVoltage(session.outletCode, now);
    const maxCurrentAmp =
      settings.maxCurrentAmp || toNumber(session.maxCurrentAmp) || settings.defaultMaxCurrentAmp || 12;
    const currentAmp = simulateCurrent(session.outletCode, now, maxCurrentAmp);
    const powerW = Math.round(voltage * currentAmp);
    const baseEnergyWh = latest?.energyWh ?? session.meterStartWh ?? 0;
    const energyWh = baseEnergyWh + Math.round((powerW * seconds) / 3600);
    const energyKwh = Math.max(0, (energyWh - (session.meterStartWh ?? 0)) / 1000);
    const ratePerKwh = toNumber(session.ratePerKwh);
    const powerKw = powerW / 1000;
    const peakPowerKw = Math.max(toNumber(session.peakPowerKw), powerKw);

    await db.insert(meterValues).values({
      propertyId: session.propertyId,
      sessionId: session.id,
      chargerId: session.chargerId,
      connectorId: session.connectorId,
      sampledAt: now,
      energyWh,
      powerW,
      currentA: currentAmp.toFixed(2),
      voltageV: voltage.toFixed(2),
      rawPayload: {
        simulator: true,
        voltage,
        currentAmp,
        powerW
      }
    });

    await db
      .update(chargingSessions)
      .set({
        energyKwh: energyKwh.toFixed(3),
        peakPowerKw: peakPowerKw.toFixed(2),
        averagePowerKw: powerKw.toFixed(2),
        costAmount: (energyKwh * ratePerKwh).toFixed(2),
        updatedAt: now
      })
      .where(eq(chargingSessions.id, session.id));

    inserted += 1;
  }

  return inserted;
}

export async function detectPendingStartTimeouts(db: VoltariaDb) {
  const sessions = await db
    .select()
    .from(chargingSessions)
    .where(eq(chargingSessions.status, "pending_start"))
    .limit(50);

  let closed = 0;

  for (const session of sessions) {
    const settings = await getRuntimeRuleSettings(db, session.propertyId, session.chargerId);
    const cutoff = new Date(Date.now() - settings.startupNoLoadTimeoutSeconds * 1000);

    if (session.startedAt >= cutoff) {
      continue;
    }

    await db.transaction(async (tx) => {
      await closeSession(tx, session.id, "failed", "startup_no_load_timeout", new Date());

      await tx.insert(deviceCommands).values({
        propertyId: session.propertyId,
        chargerId: session.chargerId,
        sessionId: session.id,
        commandType: "disable",
        status: "pending",
        payload: { reason: "startup_no_load_timeout", simulator: true },
        requestedBy: "simulator"
      });
    });
    closed += 1;
  }

  return closed;
}

export async function detectNoLoadSessions(db: VoltariaDb) {
  const activeSessions = await getActiveControlledOutletSessions(db);
  let closed = 0;

  for (const session of activeSessions) {
    const settings = await getRuntimeRuleSettings(db, session.propertyId, session.chargerId);
    const cutoff = new Date(Date.now() - settings.noLoadTimeoutSeconds * 1000);
    const recentValues = await db
      .select()
      .from(meterValues)
      .where(and(eq(meterValues.sessionId, session.id), gt(meterValues.sampledAt, cutoff)))
      .orderBy(desc(meterValues.sampledAt))
      .limit(60);

    if (recentValues.length < 3) {
      continue;
    }

    const allNoLoad = recentValues.every(
      (value) => (value.powerW ?? 0) < settings.lowPowerThresholdWatts
    );

    if (!allNoLoad) {
      continue;
    }

    await forceCloseSessionAndOutlet(db, session.id, "completed", "no_load_completed");
    closed += 1;
  }

  return closed;
}

export async function detectRuleLimitSessions(db: VoltariaDb) {
  const activeSessions = await getActiveControlledOutletSessions(db);
  let stopped = 0;

  for (const session of activeSessions) {
    const settings = await getRuntimeRuleSettings(db, session.propertyId, session.chargerId);
    const now = new Date();
    const durationMinutes = Math.floor((now.getTime() - session.startedAt.getTime()) / 60_000);
    const energyKwh = toNumber(session.energyKwh);
    const maxDuration = settings.maxSessionDurationMinutes;
    const maxKwh = settings.maxSessionKwh;

    if (maxDuration && durationMinutes >= maxDuration) {
      const created = await createRuleStopCommand(db, session.id, "max_duration_reached");
      stopped += created ? 1 : 0;
      continue;
    }

    if (maxKwh && energyKwh >= maxKwh) {
      const created = await createRuleStopCommand(db, session.id, "max_kwh_reached");
      stopped += created ? 1 : 0;
    }
  }

  return stopped;
}

export async function detectOverCurrentSessions(db: VoltariaDb) {
  const activeSessions = await getActiveControlledOutletSessions(db);
  let closed = 0;

  for (const session of activeSessions) {
    const latest = await getLatestSessionMeterValue(db, session.id);
    const settings = await getRuntimeRuleSettings(db, session.propertyId, session.chargerId);
    const maxCurrentAmp =
      settings.maxCurrentAmp || toNumber(session.maxCurrentAmp) || settings.defaultMaxCurrentAmp || 12;

    if (!latest || toNumber(latest.currentA) <= maxCurrentAmp) {
      continue;
    }

    await db.transaction(async (tx) => {
      if (settings.overcurrentAction === "stop_session") {
        await closeSession(tx, session.id, "failed", "over_current", new Date());
        await tx
          .update(chargers)
          .set({ status: "faulted", updatedAt: new Date() })
          .where(eq(chargers.id, session.chargerId));
      }

      await createAlertOnce(tx, {
        propertyId: session.propertyId,
        chargerId: session.chargerId,
        sessionId: session.id,
        severity: "critical",
        title: "Sobrecorriente simulada",
        description: `${session.outletCode} superó ${maxCurrentAmp} A.`,
        source: "Outlet simulator"
      });

      await tx.insert(systemEvents).values({
        propertyId: session.propertyId,
        chargerId: session.chargerId,
        sessionId: session.id,
        severity: settings.overcurrentAction === "stop_session" ? "critical" : "warning",
        eventType: "rule_overcurrent",
        message:
          settings.overcurrentAction === "stop_session"
            ? "La sesión fue detenida por sobrecorriente simulada."
            : "Se registró sobrecorriente simulada sin detener sesión.",
        metadata: { action: settings.overcurrentAction, maxCurrentAmp },
        occurredAt: new Date()
      });
    });
    closed += 1;
  }

  return closed;
}

async function createAdminOutletCommand(
  db: VoltariaDb,
  outletId: string,
  commandType: "enable" | "disable"
): Promise<RuntimeResult> {
  const [outlet] = await db
    .select()
    .from(chargers)
    .where(and(eq(chargers.id, outletId), eq(chargers.kind, "controlled_outlet")))
    .limit(1);

  if (!outlet) {
    return { ok: false, error: "No se encontró la toma controlada." };
  }

  if (commandType === "enable") {
    const decision = await evaluateOutletAvailability(db, {
      propertyId: outlet.propertyId,
      outletId: outlet.id,
      method: "admin"
    });

    if (!decision.allowed) {
      await recordRuleEvaluation(db, {
        propertyId: outlet.propertyId,
        outletId: outlet.id,
        method: "admin",
        result: "denied",
        reason: decision.reason,
        details: { source: "admin", commandType }
      });

      return { ok: false, error: decision.message };
    }
  }

  const [command] = await db
    .insert(deviceCommands)
    .values({
      propertyId: outlet.propertyId,
      chargerId: outlet.id,
      commandType,
      status: "pending",
      payload: {
        outletId: outlet.id,
        requestedMethod: "admin"
      },
      requestedBy: "admin:demo"
    })
    .returning();

  return {
    ok: true,
    message: `Comando ${commandType} creado para ${outlet.ocppIdentity}.`,
    ...(command ? { commandId: command.id } : {})
  };
}

async function createRuleStopCommand(db: VoltariaDb, sessionId: string, reason: string) {
  const [session] = await db
    .select({
      id: chargingSessions.id,
      propertyId: chargingSessions.propertyId,
      chargerId: chargingSessions.chargerId
    })
    .from(chargingSessions)
    .where(eq(chargingSessions.id, sessionId))
    .limit(1);

  if (!session) {
    return false;
  }

  const [existingCommand] = await db
    .select({ id: deviceCommands.id })
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.sessionId, session.id),
        eq(deviceCommands.commandType, "disable"),
        inArray(deviceCommands.status, ["pending", "sent"])
      )
    )
    .limit(1);

  if (existingCommand) {
    return false;
  }

  await db.transaction(async (tx) => {
    const [command] = await tx
      .insert(deviceCommands)
      .values({
        propertyId: session.propertyId,
        chargerId: session.chargerId,
        sessionId: session.id,
        commandType: "disable",
        status: "pending",
        payload: { reason, requestedMethod: "rule_engine" },
        requestedBy: "rule-engine"
      })
      .returning({ id: deviceCommands.id });

    await tx.insert(systemEvents).values({
      propertyId: session.propertyId,
      chargerId: session.chargerId,
      sessionId: session.id,
      severity: "warning",
      eventType: "rule_stop_requested",
      message: `El motor de reglas solicitó detener la sesión (${reason}).`,
      metadata: { reason, commandId: command?.id },
      occurredAt: new Date()
    });
  });

  return true;
}

async function createAlertOnce(
  db: DbExecutor,
  input: {
    propertyId: string;
    chargerId: string;
    sessionId: string;
    severity: "info" | "warning" | "critical";
    title: string;
    description: string;
    source: string;
  }
) {
  const [existing] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(
      and(
        eq(alerts.propertyId, input.propertyId),
        eq(alerts.sessionId, input.sessionId),
        eq(alerts.title, input.title),
        eq(alerts.status, "open")
      )
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(alerts).values({
    propertyId: input.propertyId,
    chargerId: input.chargerId,
    sessionId: input.sessionId,
    severity: input.severity,
    status: "open",
    title: input.title,
    description: input.description,
    source: input.source
  });
}

async function getRuntimeProperty(db: DbExecutor) {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, "torre-aurora"))
    .limit(1);

  return property ?? null;
}

async function getActiveSessionForOutlet(db: VoltariaDb, outletId: string) {
  const [session] = await db
    .select()
    .from(chargingSessions)
    .where(
      and(
        eq(chargingSessions.chargerId, outletId),
        inArray(chargingSessions.status, ACTIVE_SESSION_STATUSES)
      )
    )
    .orderBy(desc(chargingSessions.startedAt))
    .limit(1);

  return session ?? null;
}

async function getLatestOutletEnergyWh(db: DbExecutor, outletId: string) {
  const [latest] = await db
    .select({ energyWh: meterValues.energyWh })
    .from(meterValues)
    .where(eq(meterValues.chargerId, outletId))
    .orderBy(desc(meterValues.sampledAt))
    .limit(1);

  return latest?.energyWh ?? 0;
}

async function getLatestSessionMeterValue(db: DbExecutor, sessionId: string) {
  const [latest] = await db
    .select()
    .from(meterValues)
    .where(eq(meterValues.sessionId, sessionId))
    .orderBy(desc(meterValues.sampledAt))
    .limit(1);

  return latest ?? null;
}

async function getActiveControlledOutletSessions(db: VoltariaDb) {
  return db
    .select({
      id: chargingSessions.id,
      propertyId: chargingSessions.propertyId,
      chargerId: chargingSessions.chargerId,
      startedAt: chargingSessions.startedAt,
      energyKwh: chargingSessions.energyKwh,
      maxCurrentAmp: chargers.maxCurrentAmp,
      outletCode: chargers.ocppIdentity
    })
    .from(chargingSessions)
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .where(and(eq(chargers.kind, "controlled_outlet"), eq(chargingSessions.status, "active")));
}

async function forceCloseSessionAndOutlet(
  db: VoltariaDb,
  sessionId: string,
  status: "completed" | "failed" | "interrupted",
  reason: string
) {
  await db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(chargingSessions)
      .where(eq(chargingSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return;
    }

    await closeSession(tx, session.id, status, reason, new Date());
    await tx
      .update(chargers)
      .set({ status: status === "failed" ? "faulted" : "available", updatedAt: new Date() })
      .where(eq(chargers.id, session.chargerId));
  });
}

async function closeSession(
  db: DbExecutor,
  sessionId: string,
  status: "completed" | "failed" | "interrupted",
  stopReason: string,
  endedAt: Date
) {
  const [session] = await db
    .select({
      id: chargingSessions.id,
      propertyId: chargingSessions.propertyId,
      chargerId: chargingSessions.chargerId,
      startedAt: chargingSessions.startedAt,
      meterStartWh: chargingSessions.meterStartWh,
      ratePerKwh: tariffs.ratePerKwh
    })
    .from(chargingSessions)
    .leftJoin(tariffs, and(eq(tariffs.propertyId, chargingSessions.propertyId), eq(tariffs.isActive, true)))
    .where(eq(chargingSessions.id, sessionId))
    .limit(1);

  if (!session) {
    return;
  }

  const latest = await getLatestSessionMeterValue(db, session.id);
  const meterStartWh = session.meterStartWh ?? 0;
  const meterStopWh = latest?.energyWh ?? meterStartWh;
  const energyKwh = Math.max(0, (meterStopWh - meterStartWh) / 1000);
  const ratePerKwh = toNumber(session.ratePerKwh);
  const durationHours = Math.max(1 / 60, (endedAt.getTime() - session.startedAt.getTime()) / 3_600_000);
  const averagePowerKw = energyKwh / durationHours;

  await db
    .update(chargingSessions)
    .set({
      status,
      endedAt,
      meterStopWh,
      energyKwh: energyKwh.toFixed(3),
      averagePowerKw: averagePowerKw.toFixed(2),
      costAmount: (energyKwh * ratePerKwh).toFixed(2),
      stopReason,
      updatedAt: endedAt
    })
    .where(eq(chargingSessions.id, session.id));
}

function simulateVoltage(outletCode: string, now: Date) {
  const seed = hashSeed(outletCode, now);
  return 118 + (seed % 50) / 10;
}

function simulateCurrent(outletCode: string, now: Date, maxCurrentAmp: number) {
  const seed = hashSeed(outletCode, now);
  const current = 6 + (seed % 55) / 10;
  return Math.min(maxCurrentAmp, Math.max(6, current));
}

function hashSeed(value: string, now: Date) {
  const bucket = Math.floor(now.getTime() / 15_000);
  return (
    value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) + bucket
  );
}

function getPayloadReason(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  const reason = (payload as Record<string, unknown>).reason;
  return typeof reason === "string" && reason.trim().length > 0 ? reason : fallback;
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
