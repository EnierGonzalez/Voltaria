import { and, desc, eq, sql } from "drizzle-orm";
import type {
  AlertSummary,
  BillingRecordSummary,
  ChargerSummary,
  ChargingSessionSummary,
  ConsumptionPoint,
  ControlledOutletSummary,
  DeviceCommandSummary,
  MeterValuePoint,
  MobileAccessCredential,
  OcppLogSummary,
  PropertySummary,
  ResidentSummary,
  TariffSummary
} from "@voltaria/shared";
import type { VoltariaDb } from "./client";
import {
  alerts,
  apartments,
  billingRecords,
  chargerConnectors,
  chargers,
  chargingSessions,
  deviceCommands,
  meterValues,
  ocppMessages,
  properties,
  residentCredentials,
  residents,
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

  const activeSessions = sessions.filter((session) => session.status === "active");
  const completedSessions = sessions.filter((session) => session.status === "completed");
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
    activeResidents: residentsList.filter((resident) => resident.accessStatus === "success").length
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

  return points.filter((point): point is ControlledOutletSummary => {
    return (
      point.kind === "controlled_outlet" &&
      typeof point.voltage === "number" &&
      typeof point.maxCurrentAmp === "number" &&
      typeof point.publicAccessCode === "string" &&
      typeof point.controlMode === "string"
    );
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
      startedAt: chargingSessions.startedAt,
      endedAt: chargingSessions.endedAt
    })
    .from(chargingSessions)
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .leftJoin(chargerConnectors, eq(chargerConnectors.id, chargingSessions.connectorId))
    .leftJoin(residents, eq(residents.id, chargingSessions.residentId))
    .leftJoin(apartments, eq(apartments.id, chargingSessions.apartmentId))
    .leftJoin(tariffs, and(eq(tariffs.propertyId, chargingSessions.propertyId), eq(tariffs.isActive, true)))
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
      startedAt: chargingSessions.startedAt,
      endedAt: chargingSessions.endedAt
    })
    .from(chargingSessions)
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .leftJoin(chargerConnectors, eq(chargerConnectors.id, chargingSessions.connectorId))
    .leftJoin(residents, eq(residents.id, chargingSessions.residentId))
    .leftJoin(apartments, eq(apartments.id, chargingSessions.apartmentId))
    .leftJoin(tariffs, and(eq(tariffs.propertyId, chargingSessions.propertyId), eq(tariffs.isActive, true)))
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
  propertyId: string
): Promise<MobileAccessCredential | null> {
  const [row] = await db
    .select({
      id: residentCredentials.id,
      labelSource: residentCredentials.metadata,
      residentName: residents.fullName,
      apartmentNumber: apartments.number,
      propertyName: properties.name
    })
    .from(residentCredentials)
    .innerJoin(residents, eq(residents.id, residentCredentials.residentId))
    .innerJoin(properties, eq(properties.id, residents.propertyId))
    .leftJoin(apartments, eq(apartments.id, residents.apartmentId))
    .where(
      and(
        eq(residents.propertyId, propertyId),
        eq(residentCredentials.credentialType, "rfid")
      )
    )
    .orderBy(desc(residentCredentials.updatedAt))
    .limit(1);

  if (!row) {
    return null;
  }

  const metadata = normalizeRfidMetadata(row.labelSource);

  return {
    id: row.id,
    label: metadata.label,
    maskedValue: metadata.maskedValue,
    status: metadata.status,
    statusLabel: metadata.status === "active" ? "Activa" : "Suspendida",
    residentName: row.residentName,
    apartmentNumber: row.apartmentNumber ?? "Sin depto",
    propertyName: row.propertyName
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
