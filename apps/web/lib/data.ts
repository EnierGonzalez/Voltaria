import {
  createDbClientIfConfigured,
  getAlerts,
  getBillingRecords,
  getChargers,
  getChargerById,
  getConsumptionSeries,
  getDashboardSummary,
  getDefaultProperty,
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
  consumptionSeries,
  dashboardStats,
  meterValueSeries,
  mobileAccessSummary,
  monthlyConsumptionSeries,
  ocppLogs,
  recentAlerts,
  recentSessions,
  residents,
  sessionEvents,
  tariffs,
  towerChargers,
  weeklyConsumptionSeries,
  type AlertSummary,
  type BillingRecordSummary,
  type ChargerSummary,
  type ChargingSessionSummary,
  type ConsumptionPoint,
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
  sessions: ChargingSessionSummary[];
  residents: ResidentSummary[];
  billingRecords: BillingRecordSummary[];
  alerts: AlertSummary[];
  tariffs: TariffSummary[];
  consumptionSeries: ConsumptionPoint[];
  weeklyConsumptionSeries: ConsumptionPoint[];
  monthlyConsumptionSeries: ConsumptionPoint[];
};

export type ChargerDetailData = {
  charger: ChargerSummary | null;
  currentSession?: ChargingSessionSummary;
  sessions: ChargingSessionSummary[];
  logs: OcppLogSummary[];
};

export type SessionDetailData = {
  session: ChargingSessionSummary | null;
  events: SessionEventSummary[];
  meterValues: MeterValuePoint[];
  logs: OcppLogSummary[];
};

const mockDashboardData: DashboardPageData = {
  dashboardStats,
  chargers: towerChargers,
  sessions: recentSessions,
  alerts: recentAlerts,
  consumptionSeries,
  weeklyConsumptionSeries,
  monthlyConsumptionSeries
};

const mockModuleData: ModulePageData = {
  chargers: towerChargers,
  sessions: recentSessions,
  residents,
  billingRecords,
  alerts: recentAlerts,
  tariffs,
  consumptionSeries,
  weeklyConsumptionSeries,
  monthlyConsumptionSeries
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

export async function getChargerDetailPageData(chargerId: string): Promise<ChargerDetailData> {
  const mockCharger = towerChargers.find((charger) => charger.id === chargerId) ?? null;
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
      ...(mockCurrentSession ? { currentSession: mockCurrentSession } : {})
    },
    async ({ db }) => {
      const charger = await getChargerById(db, chargerId);

      if (!charger) {
        return {
          charger: mockCharger,
          sessions: mockSessions,
          logs: mockLogs,
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
