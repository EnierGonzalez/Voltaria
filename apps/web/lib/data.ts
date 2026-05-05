import {
  createDbClientIfConfigured,
  getAlerts,
  getBillingRecords,
  getChargers,
  getChargerById,
  getControlledOutletByPublicCode,
  getControlledOutlets,
  getConsumptionSeries,
  getDashboardSummary,
  getDefaultProperty,
  getCurrentDemoResident,
  getDeviceCommandsForCharger,
  getMeterValueSeries,
  getOcppLogs,
  getRecentSessions,
  getResidentRfidCredential,
  getResidents,
  getSessionById,
  getTariffs
} from "@voltaria/db";
import {
  billingRecords,
  chargingPoints,
  consumptionSeries,
  dashboardStats,
  meterValueSeries,
  mobileAccessSummary,
  mobileSessions,
  monthlyConsumptionSeries,
  ocppLogs,
  recentAlerts,
  recentSessions,
  residents,
  sessionEvents,
  tariffs,
  towerOutlets,
  weeklyConsumptionSeries,
  type AlertSummary,
  type BillingRecordSummary,
  type ChargerSummary,
  type ChargingSessionSummary,
  type ControlledOutletSummary,
  type ConsumptionPoint,
  type DeviceCommandSummary,
  type MeterValuePoint,
  type MobileAccessSummary,
  type OcppLogSummary,
  type ResidentSummary,
  type SessionEventSummary,
  type TariffSummary
} from "@voltaria/shared";

export type DashboardPageData = {
  dashboardStats: typeof dashboardStats;
  chargers: ChargerSummary[];
  sessions: ChargingSessionSummary[];
  alerts: AlertSummary[];
  consumptionSeries: ConsumptionPoint[];
  weeklyConsumptionSeries: ConsumptionPoint[];
  monthlyConsumptionSeries: ConsumptionPoint[];
};

export type ModulePageData = {
  chargers: ChargerSummary[];
  outlets: ControlledOutletSummary[];
  sessions: ChargingSessionSummary[];
  residents: ResidentSummary[];
  billingRecords: BillingRecordSummary[];
  alerts: AlertSummary[];
  tariffs: TariffSummary[];
  consumptionSeries: ConsumptionPoint[];
  weeklyConsumptionSeries: ConsumptionPoint[];
  monthlyConsumptionSeries: ConsumptionPoint[];
};

export type OutletsPageData = {
  outlets: ControlledOutletSummary[];
  sessions: ChargingSessionSummary[];
  residents: ResidentSummary[];
  tariffs: TariffSummary[];
};

export type ChargerDetailData = {
  charger: ChargerSummary | null;
  currentSession?: ChargingSessionSummary;
  sessions: ChargingSessionSummary[];
  logs: OcppLogSummary[];
  commands: DeviceCommandSummary[];
};

export type SessionDetailData = {
  session: ChargingSessionSummary | null;
  events: SessionEventSummary[];
  meterValues: MeterValuePoint[];
  logs: OcppLogSummary[];
};

export type MobileChargeData = {
  session: ChargingSessionSummary | null;
};

const mockDashboardData: DashboardPageData = {
  dashboardStats,
  chargers: chargingPoints,
  sessions: recentSessions,
  alerts: recentAlerts,
  consumptionSeries,
  weeklyConsumptionSeries,
  monthlyConsumptionSeries
};

const mockModuleData: ModulePageData = {
  chargers: chargingPoints,
  outlets: towerOutlets,
  sessions: recentSessions,
  residents,
  billingRecords,
  alerts: recentAlerts,
  tariffs,
  consumptionSeries,
  weeklyConsumptionSeries,
  monthlyConsumptionSeries
};

const mockOutletsData: OutletsPageData = {
  outlets: towerOutlets,
  sessions: recentSessions,
  residents,
  tariffs
};

export async function getDashboardPageData(): Promise<DashboardPageData> {
  return withDatabaseFallback(mockDashboardData, async ({ db }) => {
    const property = await getDefaultProperty(db);

    if (!property) {
      return mockDashboardData;
    }

    return {
      dashboardStats: await getDashboardSummary(db, property.id),
      chargers: await getChargers(db, property.id),
      sessions: await getRecentSessions(db, property.id, 20),
      alerts: await getAlerts(db, property.id),
      consumptionSeries: await safeSeries(db, property.id, "day", consumptionSeries),
      weeklyConsumptionSeries: await safeSeries(db, property.id, "week", weeklyConsumptionSeries),
      monthlyConsumptionSeries: await safeSeries(db, property.id, "month", monthlyConsumptionSeries)
    };
  });
}

export async function getModulePageData(): Promise<ModulePageData> {
  return withDatabaseFallback(mockModuleData, async ({ db }) => {
    const property = await getDefaultProperty(db);

    if (!property) {
      return mockModuleData;
    }

    const billingSummary = await getBillingRecords(db, property.id);

    return {
      chargers: await getChargers(db, property.id),
      outlets: await getControlledOutlets(db, property.id),
      sessions: await getRecentSessions(db, property.id, 50),
      residents: await getResidents(db, property.id),
      billingRecords: billingSummary,
      alerts: await getAlerts(db, property.id),
      tariffs: await getTariffs(db, property.id),
      consumptionSeries: await safeSeries(db, property.id, "day", consumptionSeries),
      weeklyConsumptionSeries: await safeSeries(db, property.id, "week", weeklyConsumptionSeries),
      monthlyConsumptionSeries: await safeSeries(db, property.id, "month", monthlyConsumptionSeries)
    };
  });
}

export async function getOutletsPageData(): Promise<OutletsPageData> {
  return withDatabaseFallback(mockOutletsData, async ({ db }) => {
    const property = await getDefaultProperty(db);

    if (!property) {
      return mockOutletsData;
    }

    const outlets = await getControlledOutlets(db, property.id);

    return {
      outlets: outlets.length > 0 ? outlets : towerOutlets,
      sessions: await getRecentSessions(db, property.id, 50),
      residents: await getResidents(db, property.id),
      tariffs: await getTariffs(db, property.id)
    };
  });
}

export async function getOutletByPublicCodeData(publicCode: string): Promise<OutletsPageData & { outlet: ControlledOutletSummary | null }> {
  const fallbackOutlet = towerOutlets.find((outlet) => outlet.publicAccessCode === publicCode) ?? null;

  return withDatabaseFallback(
    {
      ...mockOutletsData,
      outlet: fallbackOutlet
    },
    async ({ db }) => {
      const property = await getDefaultProperty(db);

      if (!property) {
        return {
          ...mockOutletsData,
          outlet: fallbackOutlet
        };
      }

      const outlet = await getControlledOutletByPublicCode(db, publicCode);
      const outlets = await getControlledOutlets(db, property.id);

      return {
        outlets: outlets.length > 0 ? outlets : towerOutlets,
        sessions: await getRecentSessions(db, property.id, 50),
        residents: await getResidents(db, property.id),
        tariffs: await getTariffs(db, property.id),
        outlet: outlet ?? fallbackOutlet
      };
    }
  );
}

export async function getChargerDetailPageData(chargerId: string): Promise<ChargerDetailData> {
  const mockCharger = chargingPoints.find((charger) => charger.id === chargerId) ?? null;
  const mockSessions = mockCharger
    ? recentSessions.filter((session) => session.chargerId === mockCharger.id)
    : [];
  const mockCurrentSession = mockCharger?.currentSessionId
    ? recentSessions.find((session) => session.id === mockCharger.currentSessionId)
    : undefined;
  const mockLogs = ocppLogs.filter((log) => log.chargerId === chargerId);

  return withDatabaseFallback(
    {
      charger: mockCharger,
      sessions: mockSessions,
      logs: mockLogs,
      commands: [],
      ...(mockCurrentSession ? { currentSession: mockCurrentSession } : {})
    },
    async ({ db }) => {
      const charger = await getChargerById(db, chargerId);

      if (!charger) {
        return {
          charger: mockCharger,
          sessions: mockSessions,
          logs: mockLogs,
          commands: [],
          ...(mockCurrentSession ? { currentSession: mockCurrentSession } : {})
        };
      }

      const sessions = await getRecentSessions(db, charger.propertyId, 50);
      const chargerSessions = sessions.filter((session) => session.chargerId === charger.id);
      const currentSession = charger.currentSessionId
        ? sessions.find((session) => session.id === charger.currentSessionId)
        : undefined;
      const logs = await getOcppLogs(db, { chargerId: charger.id });

      return {
        charger,
        sessions: chargerSessions,
        logs,
        commands: await getDeviceCommandsForCharger(db, charger.id),
        ...(currentSession ? { currentSession } : {})
      };
    }
  );
}

export async function getSessionDetailPageData(sessionId: string): Promise<SessionDetailData> {
  const mockSession = recentSessions.find((session) => session.id === sessionId) ?? null;

  return withDatabaseFallback(
    {
      session: mockSession,
      events: sessionEvents.filter((event) => event.sessionId === sessionId),
      meterValues: meterValueSeries[sessionId] ?? [],
      logs: ocppLogs.filter((log) => log.sessionId === sessionId)
    },
    async ({ db }) => {
      const session = await getSessionById(db, sessionId);

      if (!session) {
        return {
          session: mockSession,
          events: sessionEvents.filter((event) => event.sessionId === sessionId),
          meterValues: meterValueSeries[sessionId] ?? [],
          logs: ocppLogs.filter((log) => log.sessionId === sessionId)
        };
      }

      return {
        session,
        events: [],
        meterValues: await getMeterValueSeries(db, session.id),
        logs: await getOcppLogs(db, { chargerId: session.chargerId, sessionId: session.id })
      };
    }
  );
}

export async function getMobileAccessData(): Promise<MobileAccessSummary> {
  return withDatabaseFallback<MobileAccessSummary>(mobileAccessSummary, async ({ db }) => {
    const property = await getDefaultProperty(db);

    if (!property) {
      return mobileAccessSummary;
    }

    const credential = await getResidentRfidCredential(db, property.id);

    if (!credential) {
      return mobileAccessSummary;
    }

    return {
      status: credential.status === "active" ? "active" : "suspended",
      statusLabel: credential.status === "active" ? "Acceso activo" : "Tarjeta suspendida",
      credential
    };
  });
}

export async function getMobileChargeData(): Promise<MobileChargeData> {
  return withDatabaseFallback<MobileChargeData>({ session: mobileSessions[0] ?? null }, async ({ db }) => {
    const resident = await getCurrentDemoResident(db);

    if (!resident) {
      return { session: mobileSessions[0] ?? null };
    }

    const sessions = await getRecentSessions(db, resident.propertyId, 80);
    const session =
      sessions.find(
        (item) =>
          item.residentName === resident.fullName &&
          (item.status === "active" || item.status === "pending_start")
      ) ?? null;

    return { session };
  });
}

async function withDatabaseFallback<T>(
  fallback: T,
  load: (context: NonNullable<ReturnType<typeof createDbClientIfConfigured>>) => Promise<T>
) {
  const context = createDbClientIfConfigured();

  if (!context) {
    return fallback;
  }

  try {
    return await load(context);
  } catch (error) {
    console.warn("Database data unavailable; using mock fallback.");
    return fallback;
  } finally {
    await context.client.end();
  }
}

async function safeSeries(
  db: Parameters<typeof getConsumptionSeries>[0],
  propertyId: string,
  range: Parameters<typeof getConsumptionSeries>[2],
  fallback: ConsumptionPoint[]
) {
  const series = await getConsumptionSeries(db, propertyId, range);
  return series.length > 0 ? series : fallback;
}
