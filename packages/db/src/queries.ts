import { and, desc, eq, sql } from "drizzle-orm";
import type {
  AlertSummary,
  AuditBillingStatus,
  BillingCycleDetail,
  BillingCycleItemSummary,
  BillingCycleSessionItemSummary,
  BillingCycleSummary,
  BillingRecordSummary,
  ChargerSummary,
  ChargingSessionSummary,
  CommandAuditStatus,
  ConsumptionPoint,
  ControlledOutletSummary,
  EnergyAuditStatus,
  AccessDeviceSummary,
  AuthorizationAttemptSummary,
  CredentialEventSummary,
  DeviceCommandSummary,
  MeterValuePoint,
  MobileAccessCredential,
  OcppLogSummary,
  OutletAccessRuleSummary,
  PropertyAccessRuleSummary,
  PropertySummary,
  ResidentAccessRuleSummary,
  ResidentSummary,
  RuleEvaluationSummary,
  RuleAuditStatus,
  RfidCredentialSummary,
  SessionAuditStatus,
  SessionAuditSummary,
  AccessScheduleWindowSummary,
  TariffSummary
} from "@voltaria/shared";
import type { VoltariaDb } from "./client";
import {
  alerts,
  apartments,
  accessDevices,
  accessScheduleWindows,
  authorizationAttempts,
  billingCycleItems,
  billingCycleSessionItems,
  billingCycles,
  billingRecords,
  chargerConnectors,
  chargers,
  chargingSessions,
  credentialEvents,
  deviceCommands,
  meterValues,
  ocppMessages,
  outletAccessOverrides,
  propertyAccessRules,
  properties,
  residentAccessOverrides,
  residentCredentials,
  residents,
  ruleEvaluations,
  sessionAudits,
  tariffs
} from "./schema";

export type ConsumptionRange = "day" | "week" | "month";

export type DashboardSummary = {
  monthlyKwh: number;
  monthlyRevenue: number;
  activeSessions: number;
  availableConnectors: number;
  billingReady: number;
  openAlerts: number;
  currentPowerKw: number;
  averageSessionMinutes: number;
  activeResidents: number;
  rejectedSessionsToday: number;
  rejectedRfidAttemptsToday: number;
  maintenanceOutlets: number;
  ruleStoppedSessions: number;
  operationalAlerts: number;
  billableKwhMonth: number;
  billableAmountMonth: number;
  sessionsPendingReview: number;
  openBillingCycles: number;
  excludedSessions: number;
  warningSessions: number;
};

const statusLabels = {
  available: "Disponible",
  charging: "Cargando",
  offline: "Offline",
  faulted: "Falla",
  reserved: "Reservado",
  pending_start: "Pendiente",
  active: "Activa",
  completed: "Completada",
  interrupted: "Interrumpida",
  failed: "Fallida",
  paid: "Pagado",
  pending: "Pendiente",
  draft: "Borrador",
  void: "Anulado",
  info: "Info",
  warning: "Warning",
  critical: "Crítica"
} as const;

const operationalStatusLabels = {
  available: "Disponible",
  maintenance: "Mantenimiento",
  disabled: "Deshabilitada",
  reserved: "Reservada",
  occupied: "Ocupada"
} as const;

const accessOverrideStatusLabels = {
  allowed: "Permitido",
  blocked: "Bloqueado",
  suspended: "Suspendido",
  limited: "Limitado"
} as const;

const credentialStatusLabels = {
  active: "Activa",
  disabled: "Desactivada",
  lost: "Perdida",
  stolen: "Robada",
  damaged: "Dañada",
  replaced: "Reemplazada",
  expired: "Expirada",
  pending_enrollment: "Pendiente"
} as const;

const activationMethodLabels = {
  rfid: "RFID",
  mobile: "Móvil",
  admin: "Admin"
} as const;

const sessionAuditStatusLabels = {
  valid: "Válida",
  warning: "Con alerta",
  failed: "Fallida",
  needs_review: "Revisión"
} as const satisfies Record<SessionAuditStatus, string>;

const energyAuditStatusLabels = {
  normal: "Normal",
  zero_consumption: "Consumo cero",
  low_consumption: "Consumo bajo",
  suspicious_spike: "Pico sospechoso",
  missing_meter_values: "Sin mediciones",
  meter_mismatch: "Descuadre medidor"
} as const satisfies Record<EnergyAuditStatus, string>;

const commandAuditStatusLabels = {
  normal: "Normal",
  missing_enable_ack: "Enable sin ack",
  missing_disable_ack: "Disable sin ack",
  command_timeout: "Timeout"
} as const satisfies Record<CommandAuditStatus, string>;

const ruleAuditStatusLabels = {
  normal: "Normal",
  stopped_by_rule: "Detenida por regla",
  denied_before_start: "Denegada antes de iniciar"
} as const satisfies Record<RuleAuditStatus, string>;

const auditBillingStatusLabels = {
  billable: "Cobrable",
  not_billable: "No cobrable",
  excluded: "Excluida",
  pending_review: "Pendiente revisión"
} as const satisfies Record<AuditBillingStatus, string>;

const billingCycleStatusLabels = {
  draft: "Borrador",
  reviewing: "En revisión",
  approved: "Aprobado",
  exported: "Exportado",
  closed: "Cerrado"
} as const;

const billingCycleItemStatusLabels = {
  draft: "Borrador",
  approved: "Aprobado",
  excluded: "Excluido",
  adjusted: "Ajustado"
} as const;

export async function getDefaultProperty(db: VoltariaDb) {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, "torre-aurora"))
    .limit(1);

  return property ?? null;
}

export async function getPropertySummary(db: VoltariaDb, propertyId: string): Promise<PropertySummary | null> {
  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);

  if (!property) {
    return null;
  }

  return {
    id: property.id,
    name: property.name,
    address: property.address ?? "",
    timezone: property.timezone
  };
}

export async function getDashboardSummary(
  db: VoltariaDb,
  propertyId: string
): Promise<DashboardSummary> {
  const sessions = await getRecentSessions(db, propertyId, 200);
  const chargersList = await getChargers(db, propertyId);
  const alertsList = await getAlerts(db, propertyId);
  const billing = await getBillingSummary(db, propertyId);
  const residentsList = await getResidents(db, propertyId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart);
  monthStart.setDate(1);
  const [rejectedRules] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ruleEvaluations)
    .where(
      and(
        eq(ruleEvaluations.propertyId, propertyId),
        eq(ruleEvaluations.result, "denied"),
        sql`${ruleEvaluations.createdAt} >= ${todayStart}`
      )
    );
  const [rejectedRfid] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authorizationAttempts)
    .where(
      and(
        eq(authorizationAttempts.propertyId, propertyId),
        eq(authorizationAttempts.method, "rfid"),
        sql`${authorizationAttempts.result} in ('rejected', 'blocked')`,
        sql`${authorizationAttempts.createdAt} >= ${todayStart}`
      )
    );
  const [maintenance] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outletAccessOverrides)
    .where(
      and(
        eq(outletAccessOverrides.propertyId, propertyId),
        eq(outletAccessOverrides.status, "maintenance")
      )
    );
  const [ruleStops] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chargingSessions)
    .where(
      and(
        eq(chargingSessions.propertyId, propertyId),
        sql`${chargingSessions.stopReason} in ('max_duration_reached', 'max_kwh_reached', 'startup_no_load_timeout', 'no_load_completed', 'over_current')`
      )
    );
  const [billingAudit] = await db
    .select({
      billableKwh: sql<string>`coalesce(sum(case when ${sessionAudits.billingStatus} = 'billable' then ${chargingSessions.energyKwh} else 0 end), 0)`,
      billableAmount: sql<string>`coalesce(sum(case when ${sessionAudits.billingStatus} = 'billable' then ${chargingSessions.costAmount} else 0 end), 0)`,
      pendingReview: sql<number>`count(*) filter (where ${sessionAudits.auditStatus} = 'needs_review')::int`,
      excluded: sql<number>`count(*) filter (where ${sessionAudits.billingStatus} = 'excluded')::int`,
      warning: sql<number>`count(*) filter (where ${sessionAudits.auditStatus} = 'warning')::int`
    })
    .from(sessionAudits)
    .innerJoin(chargingSessions, eq(chargingSessions.id, sessionAudits.sessionId))
    .where(
      and(
        eq(sessionAudits.propertyId, propertyId),
        sql`${chargingSessions.startedAt} >= ${monthStart}`
      )
    );
  const [openCycles] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(billingCycles)
    .where(
      and(
        eq(billingCycles.propertyId, propertyId),
        sql`${billingCycles.status} in ('draft', 'reviewing', 'approved', 'exported')`
      )
    );

  const activeSessions = sessions.filter((session) => session.status === "active");
  const totalDuration = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);

  return {
    monthlyKwh: sessions.reduce((sum, session) => sum + session.deliveredKwh, 0),
    monthlyRevenue: billing.totalAmount,
    activeSessions: activeSessions.length,
    availableConnectors: chargersList
      .filter((charger) => charger.kind === "controlled_outlet" && charger.status === "available")
      .reduce((sum, charger) => sum + charger.connectors, 0),
    billingReady: billing.records.filter((record) => record.status === "pending").length,
    openAlerts: alertsList.length,
    currentPowerKw: activeSessions.reduce((sum, session) => sum + session.powerKw, 0),
    averageSessionMinutes: sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0,
    activeResidents: residentsList.filter((resident) => resident.accessStatus === "success").length,
    rejectedSessionsToday: rejectedRules?.count ?? 0,
    rejectedRfidAttemptsToday: rejectedRfid?.count ?? 0,
    maintenanceOutlets: maintenance?.count ?? 0,
    ruleStoppedSessions: ruleStops?.count ?? 0,
    operationalAlerts: alertsList.filter((alert) =>
      alert.title.toLowerCase().includes("sobrecorriente") ||
      alert.description.toLowerCase().includes("no-load")
    ).length,
    billableKwhMonth: toNumber(billingAudit?.billableKwh),
    billableAmountMonth: toNumber(billingAudit?.billableAmount),
    sessionsPendingReview: billingAudit?.pendingReview ?? 0,
    openBillingCycles: openCycles?.count ?? 0,
    excludedSessions: billingAudit?.excluded ?? 0,
    warningSessions: billingAudit?.warning ?? 0
  };
}

export async function getChargers(db: VoltariaDb, propertyId: string): Promise<ChargerSummary[]> {
  const rows = await db
    .select()
    .from(chargers)
    .where(eq(chargers.propertyId, propertyId))
    .orderBy(chargers.name);

  const connectorsRows = await db
    .select({
      chargerId: chargerConnectors.chargerId,
      count: sql<number>`count(*)::int`
    })
    .from(chargerConnectors)
    .where(eq(chargerConnectors.propertyId, propertyId))
    .groupBy(chargerConnectors.chargerId);

  const activeRows = await db
    .select({
      id: chargingSessions.id,
      chargerId: chargingSessions.chargerId,
      energyKwh: chargingSessions.energyKwh,
      powerKw: sql<string>`coalesce(${chargingSessions.averagePowerKw}, ${chargingSessions.peakPowerKw}, 0)`
    })
    .from(chargingSessions)
    .where(and(eq(chargingSessions.propertyId, propertyId), eq(chargingSessions.status, "active")));

  return rows.map((charger) => {
    const connectorsCount =
      connectorsRows.find((item) => item.chargerId === charger.id)?.count ?? 0;
    const active = activeRows.find((item) => item.chargerId === charger.id);

    return {
      id: charger.id,
      propertyId: charger.propertyId,
      kind: charger.kind,
      name: charger.name,
      code: charger.ocppIdentity,
      location: charger.location ?? "Sin ubicación",
      status: charger.status,
      statusLabel: statusLabels[charger.status],
      connectors: connectorsCount,
      maxPowerKw: toNumber(charger.maxPowerKw),
      ocppVersion: "1.6J",
      lastSeenAt: toIso(charger.lastHeartbeatAt ?? charger.updatedAt),
      ...(charger.voltage ? { voltage: charger.voltage } : {}),
      ...(charger.maxCurrentAmp ? { maxCurrentAmp: toNumber(charger.maxCurrentAmp) } : {}),
      ...(charger.publicAccessCode ? { publicAccessCode: charger.publicAccessCode } : {}),
      ...(charger.controlMode ? { controlMode: charger.controlMode } : {}),
      currentPowerKw: active ? toNumber(active.powerKw) : 0,
      currentSessionKwh: active ? toNumber(active.energyKwh) : 0,
      ...(active ? { currentSessionId: active.id } : {})
    };
  });
}

export async function getChargerById(
  db: VoltariaDb,
  chargerId: string
): Promise<ChargerSummary | null> {
  const [charger] = await db.select().from(chargers).where(eq(chargers.id, chargerId)).limit(1);

  if (!charger) {
    return null;
  }

  const [connectorsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chargerConnectors)
    .where(eq(chargerConnectors.chargerId, charger.id));

  const [active] = await db
    .select({
      id: chargingSessions.id,
      energyKwh: chargingSessions.energyKwh,
      powerKw: sql<string>`coalesce(${chargingSessions.averagePowerKw}, ${chargingSessions.peakPowerKw}, 0)`
    })
    .from(chargingSessions)
    .where(and(eq(chargingSessions.chargerId, charger.id), eq(chargingSessions.status, "active")))
    .limit(1);

  return {
    id: charger.id,
    propertyId: charger.propertyId,
    kind: charger.kind,
    name: charger.name,
    code: charger.ocppIdentity,
    location: charger.location ?? "Sin ubicación",
    status: charger.status,
    statusLabel: statusLabels[charger.status],
    connectors: connectorsCount?.count ?? 0,
    maxPowerKw: toNumber(charger.maxPowerKw),
    ocppVersion: "1.6J",
    lastSeenAt: toIso(charger.lastHeartbeatAt ?? charger.updatedAt),
    ...(charger.voltage ? { voltage: charger.voltage } : {}),
    ...(charger.maxCurrentAmp ? { maxCurrentAmp: toNumber(charger.maxCurrentAmp) } : {}),
    ...(charger.publicAccessCode ? { publicAccessCode: charger.publicAccessCode } : {}),
    ...(charger.controlMode ? { controlMode: charger.controlMode } : {}),
    currentPowerKw: active ? toNumber(active.powerKw) : 0,
    currentSessionKwh: active ? toNumber(active.energyKwh) : 0,
    ...(active ? { currentSessionId: active.id } : {})
  };
}

export async function getControlledOutlets(
  db: VoltariaDb,
  propertyId: string
): Promise<ControlledOutletSummary[]> {
  const points = await getChargers(db, propertyId);
  const overrides = await db
    .select()
    .from(outletAccessOverrides)
    .where(eq(outletAccessOverrides.propertyId, propertyId));
  const overridesByOutlet = new Map(overrides.map((override) => [override.outletId, override]));

  return points
    .filter((point): point is ControlledOutletSummary => {
      return (
        point.kind === "controlled_outlet" &&
        typeof point.voltage === "number" &&
        typeof point.maxCurrentAmp === "number" &&
        typeof point.publicAccessCode === "string" &&
        typeof point.controlMode === "string"
      );
    })
    .map((point) => {
      const override = overridesByOutlet.get(point.id);
      const operationalStatus =
        point.currentSessionId || point.status === "charging"
          ? "occupied"
          : override?.status ?? "available";

      return {
        ...point,
        operationalStatus,
        operationalStatusLabel: operationalStatusLabels[operationalStatus],
        ...(override?.allowRfid !== null && typeof override?.allowRfid !== "undefined"
          ? { allowRfid: override.allowRfid }
          : {}),
        ...(override?.allowMobile !== null && typeof override?.allowMobile !== "undefined"
          ? { allowMobile: override.allowMobile }
          : {}),
        appliedMaxCurrentAmp: toNumber(override?.maxCurrentAmp) || point.maxCurrentAmp,
        ...(override?.maxSessionDurationMinutes
          ? { appliedMaxSessionDurationMinutes: override.maxSessionDurationMinutes }
          : {})
      };
    });
}

export async function getControlledOutletByPublicCode(
  db: VoltariaDb,
  publicCode: string
): Promise<ControlledOutletSummary | null> {
  const [charger] = await db
    .select()
    .from(chargers)
    .where(and(eq(chargers.kind, "controlled_outlet"), eq(chargers.publicAccessCode, publicCode)))
    .limit(1);

  if (!charger) {
    return null;
  }

  const outlets = await getControlledOutlets(db, charger.propertyId);
  return outlets.find((outlet) => outlet.id === charger.id) ?? null;
}

export async function getRecentSessions(
  db: VoltariaDb,
  propertyId: string,
  limit = 20
): Promise<ChargingSessionSummary[]> {
  const rows = await db
    .select({
      id: chargingSessions.id,
      propertyId: chargingSessions.propertyId,
      chargerId: chargingSessions.chargerId,
      connectorNumber: chargerConnectors.connectorNumber,
      residentName: residents.fullName,
      apartmentNumber: apartments.number,
      chargerCode: chargers.ocppIdentity,
      chargerLocation: chargers.location,
      energyKwh: chargingSessions.energyKwh,
      durationMinutes: sql<number>`greatest(1, floor(extract(epoch from (coalesce(${chargingSessions.endedAt}, now()) - ${chargingSessions.startedAt})) / 60))::int`,
      powerKw: sql<string>`coalesce(${chargingSessions.averagePowerKw}, ${chargingSessions.peakPowerKw}, 0)`,
      costAmount: chargingSessions.costAmount,
      tariffName: tariffs.name,
      ratePerKwh: tariffs.ratePerKwh,
      activationMethod: chargingSessions.activationMethod,
      status: chargingSessions.status,
      auditStatus: sessionAudits.auditStatus,
      billingStatus: sessionAudits.billingStatus,
      stopReason: chargingSessions.stopReason,
      startedAt: chargingSessions.startedAt,
      endedAt: chargingSessions.endedAt
    })
    .from(chargingSessions)
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .leftJoin(chargerConnectors, eq(chargerConnectors.id, chargingSessions.connectorId))
    .leftJoin(residents, eq(residents.id, chargingSessions.residentId))
    .leftJoin(apartments, eq(apartments.id, chargingSessions.apartmentId))
    .leftJoin(tariffs, and(eq(tariffs.propertyId, chargingSessions.propertyId), eq(tariffs.isActive, true)))
    .leftJoin(sessionAudits, eq(sessionAudits.sessionId, chargingSessions.id))
    .where(eq(chargingSessions.propertyId, propertyId))
    .orderBy(desc(chargingSessions.startedAt))
    .limit(limit);

  return rows.map(mapSessionRow);
}

export async function getSessionById(
  db: VoltariaDb,
  sessionId: string
): Promise<ChargingSessionSummary | null> {
  const rows = await db
    .select({
      id: chargingSessions.id,
      propertyId: chargingSessions.propertyId,
      chargerId: chargingSessions.chargerId,
      connectorNumber: chargerConnectors.connectorNumber,
      residentName: residents.fullName,
      apartmentNumber: apartments.number,
      chargerCode: chargers.ocppIdentity,
      chargerLocation: chargers.location,
      energyKwh: chargingSessions.energyKwh,
      durationMinutes: sql<number>`greatest(1, floor(extract(epoch from (coalesce(${chargingSessions.endedAt}, now()) - ${chargingSessions.startedAt})) / 60))::int`,
      powerKw: sql<string>`coalesce(${chargingSessions.averagePowerKw}, ${chargingSessions.peakPowerKw}, 0)`,
      costAmount: chargingSessions.costAmount,
      tariffName: tariffs.name,
      ratePerKwh: tariffs.ratePerKwh,
      activationMethod: chargingSessions.activationMethod,
      status: chargingSessions.status,
      auditStatus: sessionAudits.auditStatus,
      billingStatus: sessionAudits.billingStatus,
      stopReason: chargingSessions.stopReason,
      startedAt: chargingSessions.startedAt,
      endedAt: chargingSessions.endedAt
    })
    .from(chargingSessions)
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .leftJoin(chargerConnectors, eq(chargerConnectors.id, chargingSessions.connectorId))
    .leftJoin(residents, eq(residents.id, chargingSessions.residentId))
    .leftJoin(apartments, eq(apartments.id, chargingSessions.apartmentId))
    .leftJoin(tariffs, and(eq(tariffs.propertyId, chargingSessions.propertyId), eq(tariffs.isActive, true)))
    .leftJoin(sessionAudits, eq(sessionAudits.sessionId, chargingSessions.id))
    .where(eq(chargingSessions.id, sessionId))
    .limit(1);

  return rows[0] ? mapSessionRow(rows[0]) : null;
}

export async function getResidents(db: VoltariaDb, propertyId: string): Promise<ResidentSummary[]> {
  const rows = await db
    .select({
      id: residents.id,
      propertyId: residents.propertyId,
      name: residents.fullName,
      email: residents.email,
      apartmentNumber: apartments.number,
      propertyName: properties.name,
      isActive: residents.isActive
    })
    .from(residents)
    .innerJoin(properties, eq(properties.id, residents.propertyId))
    .leftJoin(apartments, eq(apartments.id, residents.apartmentId))
    .where(eq(residents.propertyId, propertyId))
    .orderBy(residents.fullName);

  const sessions = await getRecentSessions(db, propertyId, 500);

  return rows.map((resident) => {
    const residentSessions = sessions.filter((session) => session.residentName === resident.name);
    const monthlyKwh = residentSessions.reduce((sum, session) => sum + session.deliveredKwh, 0);
    const monthlyCost = residentSessions.reduce((sum, session) => sum + session.costAmount, 0);

    return {
      id: resident.id,
      propertyId: resident.propertyId,
      name: resident.name,
      firstName: resident.name.split(" ")[0] ?? resident.name,
      initials: getInitials(resident.name),
      email: resident.email,
      apartmentNumber: resident.apartmentNumber ?? "Sin depto",
      propertyName: resident.propertyName,
      accessStatus: resident.isActive ? "success" : "warning",
      accessLabel: resident.isActive ? "Activo" : "Pendiente",
      sessionsThisMonth: residentSessions.length,
      monthlyKwh,
      averageKwh: residentSessions.length > 0 ? monthlyKwh / residentSessions.length : 0,
      monthlyCost
    };
  });
}

export async function getResidentRfidCredential(
  db: VoltariaDb,
  propertyId: string,
  residentId?: string
): Promise<MobileAccessCredential | null> {
  const filters = [
    eq(residentCredentials.propertyId, propertyId),
    eq(residentCredentials.credentialType, "rfid")
  ];

  if (residentId) {
    filters.push(eq(residentCredentials.residentId, residentId));
  }

  const [row] = await db
    .select({
      id: residentCredentials.id,
      label: residentCredentials.label,
      maskedValue: residentCredentials.maskedValue,
      status: residentCredentials.status,
      labelSource: residentCredentials.metadata,
      residentName: residents.fullName,
      apartmentNumber: apartments.number,
      propertyName: properties.name
    })
    .from(residentCredentials)
    .innerJoin(residents, eq(residents.id, residentCredentials.residentId))
    .innerJoin(properties, eq(properties.id, residents.propertyId))
    .leftJoin(apartments, eq(apartments.id, residents.apartmentId))
    .where(and(...filters))
    .orderBy(sql`case when ${residentCredentials.status} = 'active' then 0 else 1 end`, desc(residentCredentials.updatedAt))
    .limit(1);

  if (!row) {
    return null;
  }

  const metadata = normalizeRfidMetadata(row.labelSource);
  const status = row.status === "active" ? "active" : "suspended";

  return {
    id: row.id,
    label: row.label ?? metadata.label,
    maskedValue: row.maskedValue ?? metadata.maskedValue,
    status,
    statusLabel: status === "active" ? "Activa" : "Bloqueada",
    residentName: row.residentName,
    apartmentNumber: row.apartmentNumber ?? "Sin depto",
    propertyName: row.propertyName
  };
}

export async function getResidentById(
  db: VoltariaDb,
  residentId: string
): Promise<ResidentSummary | null> {
  const [row] = await db
    .select({
      id: residents.id,
      propertyId: residents.propertyId,
      name: residents.fullName,
      email: residents.email,
      apartmentNumber: apartments.number,
      propertyName: properties.name,
      isActive: residents.isActive
    })
    .from(residents)
    .innerJoin(properties, eq(properties.id, residents.propertyId))
    .leftJoin(apartments, eq(apartments.id, residents.apartmentId))
    .where(eq(residents.id, residentId))
    .limit(1);

  if (!row) {
    return null;
  }

  const sessions = await getRecentSessions(db, row.propertyId, 500);
  const residentSessions = sessions.filter((session) => session.residentName === row.name);
  const monthlyKwh = residentSessions.reduce((sum, session) => sum + session.deliveredKwh, 0);
  const monthlyCost = residentSessions.reduce((sum, session) => sum + session.costAmount, 0);

  return {
    id: row.id,
    propertyId: row.propertyId,
    name: row.name,
    firstName: row.name.split(" ")[0] ?? row.name,
    initials: getInitials(row.name),
    email: row.email,
    apartmentNumber: row.apartmentNumber ?? "Sin depto",
    propertyName: row.propertyName,
    accessStatus: row.isActive ? "success" : "warning",
    accessLabel: row.isActive ? "Activo" : "Pendiente",
    sessionsThisMonth: residentSessions.length,
    monthlyKwh,
    averageKwh: residentSessions.length > 0 ? monthlyKwh / residentSessions.length : 0,
    monthlyCost
  };
}

export async function getResidentCredentialSummaries(
  db: VoltariaDb,
  residentId: string
): Promise<RfidCredentialSummary[]> {
  const rows = await db
    .select()
    .from(residentCredentials)
    .where(and(eq(residentCredentials.residentId, residentId), eq(residentCredentials.credentialType, "rfid")))
    .orderBy(desc(residentCredentials.createdAt));

  return rows.map((credential) => {
    const metadata = normalizeRfidMetadata(credential.metadata);

    return {
      id: credential.id,
      propertyId: credential.propertyId,
      residentId: credential.residentId,
      label: credential.label ?? metadata.label,
      maskedValue: credential.maskedValue ?? metadata.maskedValue,
      credentialType: "rfid",
      status: credential.status,
      statusLabel: credentialStatusLabels[credential.status],
      createdAt: toIso(credential.createdAt),
      ...(credential.lastUsedAt ? { lastUsedAt: toIso(credential.lastUsedAt) } : {})
    };
  });
}

export async function getCredentialEventsForResident(
  db: VoltariaDb,
  residentId: string
): Promise<CredentialEventSummary[]> {
  const rows = await db
    .select()
    .from(credentialEvents)
    .where(eq(credentialEvents.residentId, residentId))
    .orderBy(desc(credentialEvents.createdAt))
    .limit(50);

  return rows.map((event) => ({
    id: event.id,
    action: event.action,
    ...(event.reason ? { reason: event.reason } : {}),
    ...(event.performedBy ? { performedBy: event.performedBy } : {}),
    createdAt: toIso(event.createdAt)
  }));
}

export async function getAccessDeviceSummaries(
  db: VoltariaDb,
  propertyId: string
): Promise<AccessDeviceSummary[]> {
  const rows = await db
    .select()
    .from(accessDevices)
    .where(eq(accessDevices.propertyId, propertyId))
    .orderBy(accessDevices.name);

  return rows.map((device) => ({
    id: device.id,
    propertyId: device.propertyId,
    code: device.code,
    name: device.name,
    kind: device.kind,
    status: device.status,
    ...(device.locationLabel ? { locationLabel: device.locationLabel } : {})
  }));
}

export async function getPropertyAccessRuleSummary(
  db: VoltariaDb,
  propertyId: string
): Promise<PropertyAccessRuleSummary | null> {
  const [rule] = await db
    .select()
    .from(propertyAccessRules)
    .where(and(eq(propertyAccessRules.propertyId, propertyId), eq(propertyAccessRules.active, true)))
    .orderBy(desc(propertyAccessRules.updatedAt))
    .limit(1);

  if (!rule) {
    return null;
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
    ...(rule.maxActiveSessionsProperty !== null
      ? { maxActiveSessionsProperty: rule.maxActiveSessionsProperty }
      : {}),
    ...(rule.maxSessionDurationMinutes !== null
      ? { maxSessionDurationMinutes: rule.maxSessionDurationMinutes }
      : {}),
    ...(rule.maxSessionKwh !== null ? { maxSessionKwh: toNumber(rule.maxSessionKwh) } : {}),
    ...(rule.maxSessionCost !== null ? { maxSessionCost: toNumber(rule.maxSessionCost) } : {}),
    startupNoLoadTimeoutSeconds: rule.startupNoLoadTimeoutSeconds,
    noLoadTimeoutSeconds: rule.noLoadTimeoutSeconds,
    lowPowerThresholdWatts: toNumber(rule.lowPowerThresholdWatts),
    overcurrentAction: rule.overcurrentAction,
    ...(rule.defaultMaxCurrentAmp !== null
      ? { defaultMaxCurrentAmp: toNumber(rule.defaultMaxCurrentAmp) }
      : {})
  };
}

export async function getAccessScheduleWindowSummaries(
  db: VoltariaDb,
  propertyId: string,
  ruleId?: string
): Promise<AccessScheduleWindowSummary[]> {
  const conditions = [
    eq(accessScheduleWindows.propertyId, propertyId),
    eq(accessScheduleWindows.active, true),
    ruleId ? eq(accessScheduleWindows.ruleId, ruleId) : undefined
  ].filter(Boolean);
  const rows = await db
    .select()
    .from(accessScheduleWindows)
    .where(and(...conditions))
    .orderBy(accessScheduleWindows.dayOfWeek, accessScheduleWindows.startTime);

  return rows.map((window) => ({
    id: window.id,
    propertyId: window.propertyId,
    ...(window.ruleId ? { ruleId: window.ruleId } : {}),
    dayOfWeek: window.dayOfWeek,
    startTime: window.startTime,
    endTime: window.endTime,
    active: window.active
  }));
}

export async function getResidentAccessRuleSummary(
  db: VoltariaDb,
  residentId: string
): Promise<ResidentAccessRuleSummary | null> {
  const [resident] = await db
    .select({ id: residents.id, propertyId: residents.propertyId })
    .from(residents)
    .where(eq(residents.id, residentId))
    .limit(1);

  if (!resident) {
    return null;
  }

  const [override] = await db
    .select()
    .from(residentAccessOverrides)
    .where(
      and(
        eq(residentAccessOverrides.propertyId, resident.propertyId),
        eq(residentAccessOverrides.residentId, resident.id)
      )
    )
    .limit(1);

  if (!override) {
    return {
      propertyId: resident.propertyId,
      residentId: resident.id,
      status: "allowed",
      statusLabel: accessOverrideStatusLabels.allowed
    };
  }

  return {
    id: override.id,
    propertyId: override.propertyId,
    residentId: override.residentId,
    status: override.status,
    statusLabel: accessOverrideStatusLabels[override.status],
    ...(override.allowRfid !== null ? { allowRfid: override.allowRfid } : {}),
    ...(override.allowMobile !== null ? { allowMobile: override.allowMobile } : {}),
    ...(override.maxSessionDurationMinutes !== null
      ? { maxSessionDurationMinutes: override.maxSessionDurationMinutes }
      : {}),
    ...(override.maxSessionKwh !== null ? { maxSessionKwh: toNumber(override.maxSessionKwh) } : {}),
    ...(override.maxSessionsPerDay !== null ? { maxSessionsPerDay: override.maxSessionsPerDay } : {}),
    ...(override.notes ? { notes: override.notes } : {})
  };
}

export async function getOutletAccessRuleSummary(
  db: VoltariaDb,
  outletId: string
): Promise<OutletAccessRuleSummary | null> {
  const [outlet] = await db
    .select({ id: chargers.id, propertyId: chargers.propertyId })
    .from(chargers)
    .where(eq(chargers.id, outletId))
    .limit(1);

  if (!outlet) {
    return null;
  }

  const [override] = await db
    .select()
    .from(outletAccessOverrides)
    .where(
      and(
        eq(outletAccessOverrides.propertyId, outlet.propertyId),
        eq(outletAccessOverrides.outletId, outlet.id)
      )
    )
    .limit(1);

  if (!override) {
    return {
      propertyId: outlet.propertyId,
      outletId: outlet.id,
      status: "available",
      statusLabel: operationalStatusLabels.available
    };
  }

  return {
    id: override.id,
    propertyId: override.propertyId,
    outletId: override.outletId,
    status: override.status,
    statusLabel: operationalStatusLabels[override.status],
    ...(override.allowRfid !== null ? { allowRfid: override.allowRfid } : {}),
    ...(override.allowMobile !== null ? { allowMobile: override.allowMobile } : {}),
    ...(override.maxCurrentAmp !== null ? { maxCurrentAmp: toNumber(override.maxCurrentAmp) } : {}),
    ...(override.maxSessionDurationMinutes !== null
      ? { maxSessionDurationMinutes: override.maxSessionDurationMinutes }
      : {}),
    ...(override.notes ? { notes: override.notes } : {})
  };
}

export async function getAlerts(db: VoltariaDb, propertyId: string): Promise<AlertSummary[]> {
  const rows = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.propertyId, propertyId), eq(alerts.status, "open")))
    .orderBy(desc(alerts.createdAt));

  return rows.map((alert) => ({
    id: alert.id,
    propertyId: alert.propertyId,
    ...(alert.chargerId ? { chargerId: alert.chargerId } : {}),
    ...(alert.sessionId ? { sessionId: alert.sessionId } : {}),
    title: alert.title,
    description: alert.description ?? "",
    severity: alert.severity,
    severityLabel: statusLabels[alert.severity],
    source: alert.source ?? "System"
  }));
}

export async function getBillingRecords(
  db: VoltariaDb,
  propertyId: string
): Promise<BillingRecordSummary[]> {
  const rows = await db
    .select({
      id: billingRecords.id,
      propertyId: billingRecords.propertyId,
      periodStart: billingRecords.periodStart,
      apartmentNumber: apartments.number,
      residentName: residents.fullName,
      kwh: billingRecords.energyKwh,
      ratePerKwh: billingRecords.ratePerKwh,
      totalAmount: billingRecords.totalAmount,
      status: billingRecords.status
    })
    .from(billingRecords)
    .leftJoin(apartments, eq(apartments.id, billingRecords.apartmentId))
    .leftJoin(residents, eq(residents.id, billingRecords.residentId))
    .where(eq(billingRecords.propertyId, propertyId))
    .orderBy(desc(billingRecords.periodStart));

  return rows.map((record) => ({
    id: record.id,
    propertyId: record.propertyId,
    period: formatPeriod(record.periodStart),
    apartmentNumber: record.apartmentNumber ?? "Sin depto",
    residentName: record.residentName ?? "Sin residente",
    kwh: toNumber(record.kwh),
    ratePerKwh: toNumber(record.ratePerKwh),
    totalAmount: toNumber(record.totalAmount),
    status: record.status === "paid" ? "paid" : "pending",
    statusLabel: record.status === "paid" ? statusLabels.paid : statusLabels.pending
  }));
}

export async function getBillingSummary(db: VoltariaDb, propertyId: string) {
  const records = await getBillingRecords(db, propertyId);

  return {
    records,
    totalAmount: records.reduce((sum, record) => sum + record.totalAmount, 0),
    totalKwh: records.reduce((sum, record) => sum + record.kwh, 0)
  };
}

export async function getSessionAuditSummaries(
  db: VoltariaDb,
  propertyId: string,
  limit = 100
): Promise<SessionAuditSummary[]> {
  const rows = await db
    .select({
      id: sessionAudits.id,
      propertyId: sessionAudits.propertyId,
      sessionId: sessionAudits.sessionId,
      residentId: sessionAudits.residentId,
      apartmentId: sessionAudits.apartmentId,
      outletId: sessionAudits.outletId,
      residentName: residents.fullName,
      apartmentNumber: apartments.number,
      outletCode: chargers.ocppIdentity,
      sessionStartedAt: chargingSessions.startedAt,
      deliveredKwh: chargingSessions.energyKwh,
      amount: chargingSessions.costAmount,
      auditStatus: sessionAudits.auditStatus,
      energyStatus: sessionAudits.energyStatus,
      commandStatus: sessionAudits.commandStatus,
      ruleStatus: sessionAudits.ruleStatus,
      billingStatus: sessionAudits.billingStatus,
      reviewedBy: sessionAudits.reviewedBy,
      reviewedAt: sessionAudits.reviewedAt,
      notes: sessionAudits.notes,
      details: sessionAudits.details,
      createdAt: sessionAudits.createdAt,
      updatedAt: sessionAudits.updatedAt
    })
    .from(sessionAudits)
    .innerJoin(chargingSessions, eq(chargingSessions.id, sessionAudits.sessionId))
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .leftJoin(residents, eq(residents.id, chargingSessions.residentId))
    .leftJoin(apartments, eq(apartments.id, chargingSessions.apartmentId))
    .where(eq(sessionAudits.propertyId, propertyId))
    .orderBy(desc(sessionAudits.updatedAt))
    .limit(limit);

  return rows.map(mapSessionAuditRow);
}

export async function getSessionAuditSummaryBySessionId(
  db: VoltariaDb,
  sessionId: string
): Promise<SessionAuditSummary | null> {
  const rows = await db
    .select({
      id: sessionAudits.id,
      propertyId: sessionAudits.propertyId,
      sessionId: sessionAudits.sessionId,
      residentId: sessionAudits.residentId,
      apartmentId: sessionAudits.apartmentId,
      outletId: sessionAudits.outletId,
      residentName: residents.fullName,
      apartmentNumber: apartments.number,
      outletCode: chargers.ocppIdentity,
      sessionStartedAt: chargingSessions.startedAt,
      deliveredKwh: chargingSessions.energyKwh,
      amount: chargingSessions.costAmount,
      auditStatus: sessionAudits.auditStatus,
      energyStatus: sessionAudits.energyStatus,
      commandStatus: sessionAudits.commandStatus,
      ruleStatus: sessionAudits.ruleStatus,
      billingStatus: sessionAudits.billingStatus,
      reviewedBy: sessionAudits.reviewedBy,
      reviewedAt: sessionAudits.reviewedAt,
      notes: sessionAudits.notes,
      details: sessionAudits.details,
      createdAt: sessionAudits.createdAt,
      updatedAt: sessionAudits.updatedAt
    })
    .from(sessionAudits)
    .innerJoin(chargingSessions, eq(chargingSessions.id, sessionAudits.sessionId))
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .leftJoin(residents, eq(residents.id, chargingSessions.residentId))
    .leftJoin(apartments, eq(apartments.id, chargingSessions.apartmentId))
    .where(eq(sessionAudits.sessionId, sessionId))
    .limit(1);

  return rows[0] ? mapSessionAuditRow(rows[0]) : null;
}

export async function getBillingCycleSummaries(
  db: VoltariaDb,
  propertyId: string
): Promise<BillingCycleSummary[]> {
  const rows = await db
    .select()
    .from(billingCycles)
    .where(eq(billingCycles.propertyId, propertyId))
    .orderBy(desc(billingCycles.periodStart));

  return rows.map(mapBillingCycleRow);
}

export async function getBillingCycleDetailSummary(
  db: VoltariaDb,
  billingCycleId: string
): Promise<BillingCycleDetail | null> {
  const [cycle] = await db
    .select()
    .from(billingCycles)
    .where(eq(billingCycles.id, billingCycleId))
    .limit(1);

  if (!cycle) {
    return null;
  }

  const itemRows = await db
    .select({
      id: billingCycleItems.id,
      billingCycleId: billingCycleItems.billingCycleId,
      propertyId: billingCycleItems.propertyId,
      residentId: billingCycleItems.residentId,
      apartmentId: billingCycleItems.apartmentId,
      apartmentNumber: apartments.number,
      residentName: residents.fullName,
      totalKwh: billingCycleItems.totalKwh,
      totalAmount: billingCycleItems.totalAmount,
      adjustmentAmount: billingCycleItems.adjustmentAmount,
      adjustmentReason: billingCycleItems.adjustmentReason,
      totalSessions: billingCycleItems.totalSessions,
      validSessions: billingCycleItems.validSessions,
      warningSessions: billingCycleItems.warningSessions,
      excludedSessions: billingCycleItems.excludedSessions,
      status: billingCycleItems.status,
      notes: billingCycleItems.notes
    })
    .from(billingCycleItems)
    .innerJoin(apartments, eq(apartments.id, billingCycleItems.apartmentId))
    .leftJoin(residents, eq(residents.id, billingCycleItems.residentId))
    .where(eq(billingCycleItems.billingCycleId, billingCycleId))
    .orderBy(apartments.number);

  const sessionRows = await db
    .select({
      id: billingCycleSessionItems.id,
      billingCycleId: billingCycleSessionItems.billingCycleId,
      billingCycleItemId: billingCycleSessionItems.billingCycleItemId,
      sessionId: billingCycleSessionItems.sessionId,
      residentName: residents.fullName,
      apartmentNumber: apartments.number,
      outletCode: chargers.ocppIdentity,
      startedAt: chargingSessions.startedAt,
      energyDeliveredKwh: billingCycleSessionItems.energyDeliveredKwh,
      amount: billingCycleSessionItems.amount,
      auditStatus: billingCycleSessionItems.auditStatus,
      billingStatus: billingCycleSessionItems.billingStatus,
      included: billingCycleSessionItems.included,
      exclusionReason: billingCycleSessionItems.exclusionReason
    })
    .from(billingCycleSessionItems)
    .innerJoin(chargingSessions, eq(chargingSessions.id, billingCycleSessionItems.sessionId))
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .leftJoin(residents, eq(residents.id, billingCycleSessionItems.residentId))
    .leftJoin(apartments, eq(apartments.id, billingCycleSessionItems.apartmentId))
    .where(eq(billingCycleSessionItems.billingCycleId, billingCycleId))
    .orderBy(desc(chargingSessions.startedAt));

  return {
    cycle: mapBillingCycleRow(cycle),
    items: itemRows.map((row): BillingCycleItemSummary => {
      const adjustmentAmount = toNumber(row.adjustmentAmount);

      return {
        id: row.id,
        billingCycleId: row.billingCycleId,
        propertyId: row.propertyId,
        ...(row.residentId ? { residentId: row.residentId } : {}),
        apartmentId: row.apartmentId,
        apartmentNumber: row.apartmentNumber,
        residentName: row.residentName ?? "Sin residente",
        totalKwh: toNumber(row.totalKwh),
        totalAmount: toNumber(row.totalAmount),
        ...(row.adjustmentAmount !== null ? { adjustmentAmount } : {}),
        ...(row.adjustmentReason ? { adjustmentReason: row.adjustmentReason } : {}),
        finalAmount: toNumber(row.totalAmount) + adjustmentAmount,
        totalSessions: row.totalSessions,
        validSessions: row.validSessions,
        warningSessions: row.warningSessions,
        excludedSessions: row.excludedSessions,
        status: row.status,
        statusLabel: billingCycleItemStatusLabels[row.status],
        ...(row.notes ? { notes: row.notes } : {})
      };
    }),
    sessions: sessionRows.map((row): BillingCycleSessionItemSummary => ({
      id: row.id,
      billingCycleId: row.billingCycleId,
      billingCycleItemId: row.billingCycleItemId,
      sessionId: row.sessionId,
      residentName: row.residentName ?? "Sin residente",
      apartmentNumber: row.apartmentNumber ?? "Sin depto",
      outletCode: row.outletCode,
      startedAt: toIso(row.startedAt),
      energyDeliveredKwh: toNumber(row.energyDeliveredKwh),
      amount: toNumber(row.amount),
      auditStatus: row.auditStatus,
      auditStatusLabel: sessionAuditStatusLabels[row.auditStatus],
      billingStatus: row.billingStatus,
      billingStatusLabel: auditBillingStatusLabels[row.billingStatus],
      included: row.included,
      ...(row.exclusionReason ? { exclusionReason: row.exclusionReason } : {})
    }))
  };
}

export async function getTariffs(db: VoltariaDb, propertyId: string): Promise<TariffSummary[]> {
  const rows = await db
    .select()
    .from(tariffs)
    .where(eq(tariffs.propertyId, propertyId))
    .orderBy(desc(tariffs.validFrom));

  return rows.map((tariff) => ({
    id: tariff.id,
    propertyId: tariff.propertyId,
    name: tariff.name,
    ratePerKwh: toNumber(tariff.ratePerKwh),
    currency: tariff.currency
  }));
}

export async function getConsumptionSeries(
  db: VoltariaDb,
  propertyId: string,
  range: ConsumptionRange
): Promise<ConsumptionPoint[]> {
  const bucketSql =
    range === "month"
      ? sql<Date>`date_trunc('month', ${chargingSessions.startedAt})`
      : range === "week"
        ? sql<Date>`date_trunc('week', ${chargingSessions.startedAt})`
        : sql<Date>`date_trunc('day', ${chargingSessions.startedAt})`;

  const rows = await db
    .select({
      bucket: bucketSql,
      kwh: sql<string>`coalesce(sum(${chargingSessions.energyKwh}), 0)`,
      sessions: sql<number>`count(*)::int`,
      costAmount: sql<string>`coalesce(sum(${chargingSessions.costAmount}), 0)`
    })
    .from(chargingSessions)
    .where(eq(chargingSessions.propertyId, propertyId))
    .groupBy(bucketSql)
    .orderBy(bucketSql);

  return rows.slice(-seriesLimit(range)).map((row) => {
    const date = toDate(row.bucket);

    return {
      label: formatBucketLabel(date, range),
      date: date.toISOString().slice(0, 10),
      kwh: toNumber(row.kwh),
      sessions: row.sessions,
      costAmount: toNumber(row.costAmount)
    };
  });
}

export async function getMeterValueSeries(
  db: VoltariaDb,
  sessionId: string
): Promise<MeterValuePoint[]> {
  const rows = await db
    .select()
    .from(meterValues)
    .where(eq(meterValues.sessionId, sessionId))
    .orderBy(meterValues.sampledAt);

  return rows.map((row) => ({
    label: new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(row.sampledAt),
    sampledAt: toIso(row.sampledAt),
    energyKwh: (row.energyWh ?? 0) / 1000,
    powerKw: (row.powerW ?? 0) / 1000
  }));
}

export async function getOcppLogs(
  db: VoltariaDb,
  filters: { chargerId?: string; sessionId?: string }
): Promise<OcppLogSummary[]> {
  const conditions = [
    filters.chargerId ? eq(ocppMessages.chargerId, filters.chargerId) : undefined
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(ocppMessages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ocppMessages.receivedAt))
    .limit(20);

  return rows
    .filter((row) => {
      if (!filters.sessionId) {
        return true;
      }

      const payload = row.payload;
      return Boolean(
        payload &&
          typeof payload === "object" &&
          !Array.isArray(payload) &&
          payload.sessionId === filters.sessionId
      );
    })
    .map((row) => ({
      id: row.id,
      chargerId: row.chargerId ?? "",
      ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
      direction: row.direction,
      action: row.action ?? "Unknown",
      messageTypeId: row.messageTypeId === 3 || row.messageTypeId === 4 ? row.messageTypeId : 2,
      uniqueId: row.uniqueId ?? "",
      payloadSummary: summarizePayload(row.payload),
      createdAt: toIso(row.receivedAt)
    }));
}

export async function getDeviceCommandsForCharger(
  db: VoltariaDb,
  chargerId: string,
  limit = 12
): Promise<DeviceCommandSummary[]> {
  const rows = await db
    .select()
    .from(deviceCommands)
    .where(eq(deviceCommands.chargerId, chargerId))
    .orderBy(desc(deviceCommands.createdAt))
    .limit(limit);

  return rows.map((command) => ({
    id: command.id,
    ...(command.chargerId ? { chargerId: command.chargerId } : {}),
    ...(command.sessionId ? { sessionId: command.sessionId } : {}),
    commandType: command.commandType,
    status: command.status,
    ...(command.requestedBy ? { requestedBy: command.requestedBy } : {}),
    createdAt: toIso(command.createdAt),
    ...(command.acknowledgedAt ? { acknowledgedAt: toIso(command.acknowledgedAt) } : {})
  }));
}

export async function getDeviceCommandsForSession(
  db: VoltariaDb,
  sessionId: string,
  limit = 12
): Promise<DeviceCommandSummary[]> {
  const rows = await db
    .select()
    .from(deviceCommands)
    .where(eq(deviceCommands.sessionId, sessionId))
    .orderBy(desc(deviceCommands.createdAt))
    .limit(limit);

  return rows.map((command) => ({
    id: command.id,
    ...(command.chargerId ? { chargerId: command.chargerId } : {}),
    ...(command.sessionId ? { sessionId: command.sessionId } : {}),
    commandType: command.commandType,
    status: command.status,
    ...(command.requestedBy ? { requestedBy: command.requestedBy } : {}),
    createdAt: toIso(command.createdAt),
    ...(command.acknowledgedAt ? { acknowledgedAt: toIso(command.acknowledgedAt) } : {})
  }));
}

export async function getRuleEvaluationsForSession(
  db: VoltariaDb,
  sessionId: string,
  limit = 12
): Promise<RuleEvaluationSummary[]> {
  const rows = await db
    .select()
    .from(ruleEvaluations)
    .where(eq(ruleEvaluations.sessionId, sessionId))
    .orderBy(desc(ruleEvaluations.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    propertyId: row.propertyId,
    ...(row.sessionId ? { sessionId: row.sessionId } : {}),
    method: row.method,
    result: row.result,
    reason: row.reason,
    details: row.details,
    createdAt: toIso(row.createdAt)
  }));
}

export async function getAuthorizationAttemptsForSession(
  db: VoltariaDb,
  sessionId: string,
  limit = 12
): Promise<AuthorizationAttemptSummary[]> {
  const rows = await db
    .select({
      id: authorizationAttempts.id,
      propertyId: authorizationAttempts.propertyId,
      method: authorizationAttempts.method,
      result: authorizationAttempts.result,
      reason: authorizationAttempts.reason,
      maskedValue: authorizationAttempts.maskedValue,
      metadata: authorizationAttempts.metadata,
      createdAt: authorizationAttempts.createdAt
    })
    .from(authorizationAttempts)
    .where(sql`${authorizationAttempts.metadata}->>'sessionId' = ${sessionId}`)
    .orderBy(desc(authorizationAttempts.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    propertyId: row.propertyId,
    sessionId,
    method: row.method,
    result: row.result,
    ...(row.reason ? { reason: row.reason } : {}),
    ...(row.maskedValue ? { maskedValue: row.maskedValue } : {}),
    createdAt: toIso(row.createdAt)
  }));
}

function mapSessionAuditRow(row: {
  id: string;
  propertyId: string;
  sessionId: string;
  residentId: string | null;
  apartmentId: string | null;
  outletId: string | null;
  residentName: string | null;
  apartmentNumber: string | null;
  outletCode: string;
  sessionStartedAt: Date;
  deliveredKwh: string;
  amount: string;
  auditStatus: SessionAuditStatus;
  energyStatus: EnergyAuditStatus;
  commandStatus: CommandAuditStatus;
  ruleStatus: RuleAuditStatus;
  billingStatus: AuditBillingStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  notes: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}): SessionAuditSummary {
  return {
    id: row.id,
    propertyId: row.propertyId,
    sessionId: row.sessionId,
    ...(row.residentId ? { residentId: row.residentId } : {}),
    ...(row.apartmentId ? { apartmentId: row.apartmentId } : {}),
    ...(row.outletId ? { outletId: row.outletId } : {}),
    residentName: row.residentName ?? "Sin residente",
    apartmentNumber: row.apartmentNumber ?? "Sin depto",
    outletCode: row.outletCode,
    sessionStartedAt: toIso(row.sessionStartedAt),
    deliveredKwh: toNumber(row.deliveredKwh),
    amount: toNumber(row.amount),
    auditStatus: row.auditStatus,
    auditStatusLabel: sessionAuditStatusLabels[row.auditStatus],
    energyStatus: row.energyStatus,
    energyStatusLabel: energyAuditStatusLabels[row.energyStatus],
    commandStatus: row.commandStatus,
    commandStatusLabel: commandAuditStatusLabels[row.commandStatus],
    ruleStatus: row.ruleStatus,
    ruleStatusLabel: ruleAuditStatusLabels[row.ruleStatus],
    billingStatus: row.billingStatus,
    billingStatusLabel: auditBillingStatusLabels[row.billingStatus],
    ...(row.reviewedBy ? { reviewedBy: row.reviewedBy } : {}),
    ...(row.reviewedAt ? { reviewedAt: toIso(row.reviewedAt) } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    details: row.details,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

function mapBillingCycleRow(row: {
  id: string;
  propertyId: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  status: "draft" | "reviewing" | "approved" | "exported" | "closed";
  totalKwh: string;
  totalAmount: string;
  totalSessions: number;
  createdAt: Date;
  approvedAt: Date | null;
}): BillingCycleSummary {
  return {
    id: row.id,
    propertyId: row.propertyId,
    name: row.name,
    periodStart: toIso(row.periodStart),
    periodEnd: toIso(row.periodEnd),
    status: row.status,
    statusLabel: billingCycleStatusLabels[row.status],
    totalKwh: toNumber(row.totalKwh),
    totalAmount: toNumber(row.totalAmount),
    totalSessions: row.totalSessions,
    createdAt: toIso(row.createdAt),
    ...(row.approvedAt ? { approvedAt: toIso(row.approvedAt) } : {})
  };
}

function mapSessionRow(row: {
  id: string;
  propertyId: string;
  chargerId: string;
  connectorNumber: number | null;
  residentName: string | null;
  apartmentNumber: string | null;
  chargerCode: string;
  chargerLocation: string | null;
  energyKwh: string;
  durationMinutes: number;
  powerKw: string;
  costAmount: string;
  tariffName: string | null;
  ratePerKwh: string | null;
  activationMethod: "rfid" | "mobile" | "admin" | null;
  status: "pending_start" | "active" | "completed" | "interrupted" | "failed";
  auditStatus: SessionAuditStatus | null;
  billingStatus: AuditBillingStatus | null;
  stopReason: string | null;
  startedAt: Date;
  endedAt: Date | null;
}): ChargingSessionSummary {
  return {
    id: row.id,
    propertyId: row.propertyId,
    chargerId: row.chargerId,
    connectorNumber: row.connectorNumber ?? 1,
    residentName: row.residentName ?? "Sin residente",
    apartmentNumber: row.apartmentNumber ?? "Sin depto",
    chargerCode: row.chargerCode,
    chargerLocation: row.chargerLocation ?? "Sin ubicación",
    deliveredKwh: toNumber(row.energyKwh),
    durationMinutes: row.durationMinutes,
    powerKw: toNumber(row.powerKw),
    costAmount: toNumber(row.costAmount),
    tariffName: row.tariffName ?? "Tarifa activa",
    ratePerKwh: toNumber(row.ratePerKwh),
    status: row.status,
    statusLabel: statusLabels[row.status],
    ...(row.activationMethod ? { activationMethod: row.activationMethod } : {}),
    ...(row.activationMethod ? { activationMethodLabel: activationMethodLabels[row.activationMethod] } : {}),
    ...(row.auditStatus
      ? {
          auditStatus: row.auditStatus,
          auditStatusLabel: sessionAuditStatusLabels[row.auditStatus]
        }
      : {}),
    ...(row.billingStatus
      ? {
          billingStatus: row.billingStatus,
          billingStatusLabel: auditBillingStatusLabels[row.billingStatus]
        }
      : {}),
    ...(row.stopReason ? { stopReason: row.stopReason } : {}),
    startedAt: toIso(row.startedAt),
    ...(row.endedAt ? { endedAt: toIso(row.endedAt) } : {}),
    shortDate: formatShortDate(row.startedAt),
    dateLabel: formatDateLabel(row.startedAt)
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

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short"
  }).format(value);
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatPeriod(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric"
  }).format(value);
}

function formatBucketLabel(value: Date, range: ConsumptionRange) {
  if (range === "month") {
    return new Intl.DateTimeFormat("es-MX", { month: "short" }).format(value);
  }

  if (range === "week") {
    const week = Math.ceil(value.getDate() / 7);
    return `Sem ${week}`;
  }

  return new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(value);
}

function seriesLimit(range: ConsumptionRange) {
  if (range === "month") {
    return 6;
  }

  if (range === "week") {
    return 8;
  }

  return 7;
}

function normalizeRfidMetadata(metadata: unknown) {
  const record =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  const rawStatus = record.status;
  const status: MobileAccessCredential["status"] =
    rawStatus === "suspended" ? "suspended" : "active";
  const label = typeof record.label === "string" ? record.label : "Tarjeta RFID principal";
  const maskedValue =
    typeof record.maskedValue === "string" && record.maskedValue.trim().length > 0
      ? record.maskedValue
      : "****A91F";

  return {
    label,
    maskedValue,
    status
  };
}

function summarizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Sin payload";
  }

  if (Array.isArray(payload)) {
    return `${payload.length} elementos`;
  }

  const entries = Object.entries(payload).slice(0, 3);
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}
