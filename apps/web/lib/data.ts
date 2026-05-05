import {
  createDbClientIfConfigured,
  getAlerts,
  getBillingRecords,
  getChargers,
  getChargerById,
  getAccessDeviceSummaries,
  getControlledOutletByPublicCode,
  getControlledOutlets,
  getConsumptionSeries,
  getDashboardSummary,
  getDefaultProperty,
  getCurrentDemoResident,
  getDeviceCommandsForCharger,
  getCredentialEventsForResident,
  getAccessScheduleWindowSummaries,
  getMeterValueSeries,
  getOcppLogs,
  getOutletAccessRuleSummary,
  getPropertyAccessRuleSummary,
  getRecentSessions,
  getResidentAccessRuleSummary,
  getResidentById,
  getResidentCredentialSummaries,
  getResidentRfidCredential,
  getResidents,
  getSessionById,
  getTariffs,
  loadDatabaseEnv
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
  type AccessDeviceSummary,
  type BillingRecordSummary,
  type ChargerSummary,
  type ChargingSessionSummary,
  type ControlledOutletSummary,
  type ConsumptionPoint,
  type CredentialEventSummary,
  type DeviceCommandSummary,
  type MeterValuePoint,
  type MobileAccessSummary,
  type OcppLogSummary,
  type OutletAccessRuleSummary,
  type AccessScheduleWindowSummary,
  type PropertyAccessRuleSummary,
  type ResidentAccessRuleSummary,
  type ResidentSummary,
  type RfidCredentialSummary,
  type SessionEventSummary,
  type TariffSummary
} from "@voltaria/shared";

loadDatabaseEnv();

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
  outletRule?: OutletAccessRuleSummary | null;
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

export type ResidentDetailPageData = {
  resident: ResidentSummary | null;
  sessions: ChargingSessionSummary[];
  credentials: RfidCredentialSummary[];
  credentialEvents: CredentialEventSummary[];
  accessDevices: AccessDeviceSummary[];
  accessRule: ResidentAccessRuleSummary | null;
};

export type RfidSimulatorPageData = {
  accessDevices: AccessDeviceSummary[];
  outlets: ControlledOutletSummary[];
};

export type RulesSettingsPageData = {
  rule: PropertyAccessRuleSummary | null;
  schedules: AccessScheduleWindowSummary[];
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

const mockAccessDevices: AccessDeviceSummary[] = [
  {
    id: "access_device_rfid_panel_p1",
    propertyId: "prop_aurora",
    code: "RFID-PANEL-P1",
    name: "Panel RFID Nivel P1",
    kind: "rfid_kiosk",
    status: "online",
    locationLabel: "Nivel P1"
  }
];

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
      outletRule: charger.kind === "controlled_outlet" ? await getOutletAccessRuleSummary(db, charger.id) : null,
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

export async function getResidentDetailPageData(residentId: string): Promise<ResidentDetailPageData> {
  const mockResident = residents.find((resident) => resident.id === residentId) ?? null;
  const mockResidentSessions = mockResident
    ? recentSessions.filter((session) => session.residentName === mockResident.name)
    : [];

  return withDatabaseFallback(
    {
      resident: mockResident,
      sessions: mockResidentSessions,
      credentials: [],
      credentialEvents: [],
      accessDevices: mockAccessDevices,
      accessRule: mockResident
        ? {
            propertyId: mockResident.propertyId,
            residentId: mockResident.id,
            status: "allowed",
            statusLabel: "Permitido"
          }
        : null
    },
    async ({ db }) => {
      const resident = await getResidentById(db, residentId);

      if (!resident) {
        return {
          resident: mockResident,
          sessions: mockResidentSessions,
          credentials: [],
          credentialEvents: [],
          accessDevices: mockAccessDevices,
          accessRule: mockResident
            ? {
                propertyId: mockResident.propertyId,
                residentId: mockResident.id,
                status: "allowed",
                statusLabel: "Permitido"
              }
            : null
        };
      }

      const sessions = await getRecentSessions(db, resident.propertyId, 80);

      return {
        resident,
        sessions: sessions.filter((session) => session.residentName === resident.name),
        credentials: await getResidentCredentialSummaries(db, resident.id),
        credentialEvents: await getCredentialEventsForResident(db, resident.id),
        accessDevices: await getAccessDeviceSummaries(db, resident.propertyId),
        accessRule: await getResidentAccessRuleSummary(db, resident.id)
      };
    }
  );
}

export async function getRfidSimulatorPageData(): Promise<RfidSimulatorPageData> {
  return withDatabaseFallback<RfidSimulatorPageData>(
    {
      accessDevices: mockAccessDevices,
      outlets: towerOutlets
    },
    async ({ db }) => {
      const property = await getDefaultProperty(db);

      if (!property) {
        return {
          accessDevices: mockAccessDevices,
          outlets: towerOutlets
        };
      }

      return {
        accessDevices: await getAccessDeviceSummaries(db, property.id),
        outlets: await getControlledOutlets(db, property.id)
      };
    }
  );
}

export async function getRulesSettingsPageData(): Promise<RulesSettingsPageData> {
  return withDatabaseFallback<RulesSettingsPageData>(
    {
      rule: {
        id: "rule_mock",
        propertyId: "prop_aurora",
        name: "Regla residencial estándar",
        active: true,
        allowRfid: true,
        allowMobile: true,
        allowAdmin: true,
        maxActiveSessionsPerResident: 1,
        maxActiveSessionsPerApartment: 2,
        maxActiveSessionsProperty: 16,
        maxSessionDurationMinutes: 480,
        startupNoLoadTimeoutSeconds: 90,
        noLoadTimeoutSeconds: 600,
        lowPowerThresholdWatts: 20,
        overcurrentAction: "stop_session",
        defaultMaxCurrentAmp: 12
      },
      schedules: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        id: `schedule_mock_${dayOfWeek}`,
        propertyId: "prop_aurora",
        ruleId: "rule_mock",
        dayOfWeek,
        startTime: "00:00",
        endTime: "23:59",
        active: true
      }))
    },
    async ({ db }) => {
      const property = await getDefaultProperty(db);

      if (!property) {
        return { rule: null, schedules: [] };
      }

      const rule = await getPropertyAccessRuleSummary(db, property.id);

      return {
        rule,
        schedules: rule ? await getAccessScheduleWindowSummaries(db, property.id, rule.id) : []
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
