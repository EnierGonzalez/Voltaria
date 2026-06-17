import {
  auditSessionsForPeriod,
  createDbClientIfConfigured,
  getAlerts,
  getAuthorizationAttemptsForSession,
  getBillingCycleDetailSummary,
  getBillingCycleSummaries,
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
  getDeviceCommandsForSession,
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
  getRuleEvaluationsForSession,
  getSessionAuditSummaries,
  getSessionAuditSummaryBySessionId,
  getSessionById,
  getTariffs,
  listAppUsers,
  loadDatabaseEnv
} from "@voltaria/db";
import {
  assertNoDefaultTenantFallbackInProduction,
  billingRecords,
  chargingPoints,
  consumptionSeries,
  dashboardStats,
  meterValueSeries,
  mobileAccessSummary,
  mobileResident,
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
  startOfMonthUtc,
  type AlertSummary,
  type AccessDeviceSummary,
  type AuthorizationAttemptSummary,
  type BillingCycleDetail,
  type BillingCycleSummary,
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
  type RuleEvaluationSummary,
  type SessionAuditSummary,
  type SessionEventSummary,
  type TariffSummary,
  isTenantFallbackBlockedError
} from "@voltaria/shared";
import type { AppUserSummary } from "@voltaria/db";
import { getCurrentResidentContext, isDevelopmentAuthFallbackAllowed } from "@/lib/auth";

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
  currentResident?: {
    id: string;
    name: string;
  };
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
  commands: DeviceCommandSummary[];
  ruleEvaluations: RuleEvaluationSummary[];
  authorizationAttempts: AuthorizationAttemptSummary[];
  audit: SessionAuditSummary | null;
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

export type AuditPageData = {
  audits: SessionAuditSummary[];
  sessions: ChargingSessionSummary[];
};

export type BillingPageData = {
  cycles: BillingCycleSummary[];
  audits: SessionAuditSummary[];
  sessions: ChargingSessionSummary[];
};

export type BillingCycleDetailPageData = {
  detail: BillingCycleDetail | null;
};

export type UsersSettingsPageData = {
  users: AppUserSummary[];
  residents: ResidentSummary[];
  propertyId: string | null;
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
  tariffs,
  currentResident: {
    id: mobileResident.id,
    name: mobileResident.name
  }
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

export async function getDashboardPageData(propertyId?: string): Promise<DashboardPageData> {
  return withDatabaseFallback(mockDashboardData, async ({ db }) => {
    const resolvedPropertyId = await resolvePropertyId(db, propertyId);

    if (!resolvedPropertyId) {
      return mockDashboardData;
    }

    return {
      dashboardStats: await getDashboardSummary(db, resolvedPropertyId),
      chargers: await getChargers(db, resolvedPropertyId),
      sessions: await getRecentSessions(db, resolvedPropertyId, 20),
      alerts: await getAlerts(db, resolvedPropertyId),
      consumptionSeries: await safeSeries(db, resolvedPropertyId, "day", consumptionSeries),
      weeklyConsumptionSeries: await safeSeries(db, resolvedPropertyId, "week", weeklyConsumptionSeries),
      monthlyConsumptionSeries: await safeSeries(db, resolvedPropertyId, "month", monthlyConsumptionSeries)
    };
  });
}

export async function getModulePageData(propertyId?: string): Promise<ModulePageData> {
  return withDatabaseFallback(mockModuleData, async ({ db }) => {
    const resolvedPropertyId = await resolvePropertyId(db, propertyId);

    if (!resolvedPropertyId) {
      return mockModuleData;
    }

    const billingSummary = await getBillingRecords(db, resolvedPropertyId);

    return {
      chargers: await getChargers(db, resolvedPropertyId),
      outlets: await getControlledOutlets(db, resolvedPropertyId),
      sessions: await getRecentSessions(db, resolvedPropertyId, 50),
      residents: await getResidents(db, resolvedPropertyId),
      billingRecords: billingSummary,
      alerts: await getAlerts(db, resolvedPropertyId),
      tariffs: await getTariffs(db, resolvedPropertyId),
      consumptionSeries: await safeSeries(db, resolvedPropertyId, "day", consumptionSeries),
      weeklyConsumptionSeries: await safeSeries(db, resolvedPropertyId, "week", weeklyConsumptionSeries),
      monthlyConsumptionSeries: await safeSeries(db, resolvedPropertyId, "month", monthlyConsumptionSeries)
    };
  });
}

export async function getOutletsPageData(propertyId?: string): Promise<OutletsPageData> {
  const residentContext = await getCurrentResidentContext();
  const fallback = isDevelopmentAuthFallbackAllowed()
    ? mockOutletsData
    : { outlets: [], sessions: [], residents: [], tariffs: [] };

  return withDatabaseFallback(fallback, async ({ db }) => {
    const resolvedPropertyId =
      propertyId ??
      residentContext?.propertyId ??
      (await resolvePropertyId(db, undefined, "mobile outlets"));

    if (!resolvedPropertyId) {
      return fallback;
    }

    const outlets = await getControlledOutlets(db, resolvedPropertyId);
    const residentList = await getResidents(db, resolvedPropertyId);
    const currentResident = residentContext?.residentId
      ? residentList.find((resident) => resident.id === residentContext.residentId)
      : null;

    return {
      outlets: outlets.length > 0 || !isDevelopmentAuthFallbackAllowed() ? outlets : towerOutlets,
      sessions: await getRecentSessions(db, resolvedPropertyId, 50),
      residents: residentList,
      tariffs: await getTariffs(db, resolvedPropertyId),
      ...(currentResident ? { currentResident: { id: currentResident.id, name: currentResident.name } } : {})
    };
  });
}

export async function getOutletByPublicCodeData(publicCode: string): Promise<OutletsPageData & { outlet: ControlledOutletSummary | null }> {
  const fallbackOutlet = towerOutlets.find((outlet) => outlet.publicAccessCode === publicCode) ?? null;
  const residentContext = await getCurrentResidentContext();
  const fallback =
    isDevelopmentAuthFallbackAllowed()
      ? {
          ...mockOutletsData,
          outlet: fallbackOutlet
        }
      : {
          outlets: [],
          sessions: [],
          residents: [],
          tariffs: [],
          outlet: null
        };

  return withDatabaseFallback(fallback, async ({ db }) => {
    const outlet = await getControlledOutletByPublicCode(db, publicCode);

    if (!outlet) {
      return fallback;
    }

    if (residentContext && residentContext.propertyId !== outlet.propertyId) {
      return {
        outlets: [],
        sessions: [],
        residents: [],
        tariffs: [],
        outlet: null
      };
    }

    if (!residentContext) {
      assertNoDefaultTenantFallbackInProduction({ flow: "mobile outlet by public code" });
    }

    const outlets = await getControlledOutlets(db, outlet.propertyId);
    const residentList = await getResidents(db, outlet.propertyId);
    const currentResident = residentContext?.residentId
      ? residentList.find((resident) => resident.id === residentContext.residentId)
      : null;

    return {
      outlets: outlets.length > 0 || !isDevelopmentAuthFallbackAllowed() ? outlets : towerOutlets,
      sessions: await getRecentSessions(db, outlet.propertyId, 50),
      residents: residentList,
      tariffs: await getTariffs(db, outlet.propertyId),
      outlet,
      ...(currentResident ? { currentResident: { id: currentResident.id, name: currentResident.name } } : {})
    };
  });
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
      logs: ocppLogs.filter((log) => log.sessionId === sessionId),
      commands: [],
      ruleEvaluations: [],
      authorizationAttempts: [],
      audit: null
    },
    async ({ db }) => {
      const session = await getSessionById(db, sessionId);

      if (!session) {
        return {
          session: mockSession,
          events: sessionEvents.filter((event) => event.sessionId === sessionId),
          meterValues: meterValueSeries[sessionId] ?? [],
          logs: ocppLogs.filter((log) => log.sessionId === sessionId),
          commands: [],
          ruleEvaluations: [],
          authorizationAttempts: [],
          audit: null
        };
      }

      return {
        session,
        events: [],
        meterValues: await getMeterValueSeries(db, session.id),
        logs: await getOcppLogs(db, { chargerId: session.chargerId, sessionId: session.id }),
        commands: await getDeviceCommandsForSession(db, session.id),
        ruleEvaluations: await getRuleEvaluationsForSession(db, session.id),
        authorizationAttempts: await getAuthorizationAttemptsForSession(db, session.id),
        audit: await getSessionAuditSummaryBySessionId(db, session.id)
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

export async function getRfidSimulatorPageData(propertyId?: string): Promise<RfidSimulatorPageData> {
  return withDatabaseFallback<RfidSimulatorPageData>(
    {
      accessDevices: mockAccessDevices,
      outlets: towerOutlets
    },
    async ({ db }) => {
      const resolvedPropertyId = await resolvePropertyId(db, propertyId);

      if (!resolvedPropertyId) {
        return {
          accessDevices: mockAccessDevices,
          outlets: towerOutlets
        };
      }

      return {
        accessDevices: await getAccessDeviceSummaries(db, resolvedPropertyId),
        outlets: await getControlledOutlets(db, resolvedPropertyId)
      };
    }
  );
}

export async function getRulesSettingsPageData(propertyId?: string): Promise<RulesSettingsPageData> {
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
      const resolvedPropertyId = await resolvePropertyId(db, propertyId);

      if (!resolvedPropertyId) {
        return { rule: null, schedules: [] };
      }

      const rule = await getPropertyAccessRuleSummary(db, resolvedPropertyId);

      return {
        rule,
        schedules: rule ? await getAccessScheduleWindowSummaries(db, resolvedPropertyId, rule.id) : []
      };
    }
  );
}

export async function getAuditPageData(propertyId?: string): Promise<AuditPageData> {
  return withDatabaseFallback<AuditPageData>(
    {
      audits: [],
      sessions: recentSessions
    },
    async ({ db }) => {
      const resolvedPropertyId = await resolvePropertyId(db, propertyId);

      if (!resolvedPropertyId) {
        return { audits: [], sessions: recentSessions };
      }

      const { start, end } = currentMonthRange();
      await auditSessionsForPeriod(db, resolvedPropertyId, start, end);

      return {
        audits: await getSessionAuditSummaries(db, resolvedPropertyId, 200),
        sessions: await getRecentSessions(db, resolvedPropertyId, 200)
      };
    }
  );
}

export async function getBillingPageData(propertyId?: string): Promise<BillingPageData> {
  return withDatabaseFallback<BillingPageData>(
    {
      cycles: [],
      audits: [],
      sessions: recentSessions
    },
    async ({ db }) => {
      const resolvedPropertyId = await resolvePropertyId(db, propertyId);

      if (!resolvedPropertyId) {
        return { cycles: [], audits: [], sessions: recentSessions };
      }

      const { start, end } = currentMonthRange();
      await auditSessionsForPeriod(db, resolvedPropertyId, start, end);

      return {
        cycles: await getBillingCycleSummaries(db, resolvedPropertyId),
        audits: await getSessionAuditSummaries(db, resolvedPropertyId, 100),
        sessions: await getRecentSessions(db, resolvedPropertyId, 100)
      };
    }
  );
}

export async function getBillingCycleDetailPageData(
  cycleId: string
): Promise<BillingCycleDetailPageData> {
  return withDatabaseFallback<BillingCycleDetailPageData>({ detail: null }, async ({ db }) => ({
    detail: await getBillingCycleDetailSummary(db, cycleId)
  }));
}

export async function getUsersSettingsPageData(propertyId?: string): Promise<UsersSettingsPageData> {
  return withDatabaseFallback<UsersSettingsPageData>(
    {
      users: [],
      residents,
      propertyId: null
    },
    async ({ db }) => {
      const resolvedPropertyId = await resolvePropertyId(db, propertyId);

      if (!resolvedPropertyId) {
        return { users: [], residents, propertyId: null };
      }

      return {
        users: await listAppUsers(db, resolvedPropertyId),
        residents: await getResidents(db, resolvedPropertyId),
        propertyId: resolvedPropertyId
      };
    }
  );
}

export async function getMobileAccessData(): Promise<MobileAccessSummary> {
  return withDatabaseFallback<MobileAccessSummary>(mobileAccessSummary, async ({ db }) => {
    const residentContext = await getCurrentResidentContext();

    if (!residentContext && !isDevelopmentAuthFallbackAllowed()) {
      return {
        status: "missing",
        statusLabel: "Sin tarjeta asignada"
      };
    }

    const propertyId =
      residentContext?.propertyId ?? (await resolvePropertyId(db, undefined, "mobile access"));

    if (!propertyId) {
      return mobileAccessSummary;
    }

    const credential = await getResidentRfidCredential(
      db,
      propertyId,
      residentContext?.residentId
    );

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
    const residentContext = await getCurrentResidentContext();
    const fallbackPropertyId =
      !residentContext && isDevelopmentAuthFallbackAllowed()
        ? await resolvePropertyId(db, undefined, "mobile charge")
        : null;
    const resident = residentContext?.residentId
      ? {
          id: residentContext.residentId,
          propertyId: residentContext.propertyId,
          fullName: residentContext.user.activeMembership?.residentName ?? residentContext.user.fullName
        }
      : isDevelopmentAuthFallbackAllowed()
        ? fallbackPropertyId
          ? await getCurrentDemoResident(db, fallbackPropertyId)
          : null
        : null;

    if (!resident) {
      return { session: null };
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
    if (!isDevelopmentAuthFallbackAllowed()) {
      throw new Error("Database is required outside development demo mode.");
    }

    return fallback;
  }

  try {
    return await load(context);
  } catch (error) {
    if (!isDevelopmentAuthFallbackAllowed() || isTenantFallbackBlockedError(error)) {
      throw error;
    }

    console.warn("Database data unavailable; using mock fallback.");
    return fallback;
  } finally {
    await context.client.end();
  }
}

async function resolvePropertyId(
  db: Parameters<typeof getDefaultProperty>[0],
  propertyId?: string,
  flow = "data loader"
) {
  if (propertyId) {
    return propertyId;
  }

  assertNoDefaultTenantFallbackInProduction({ flow });
  const property = await getDefaultProperty(db);
  return property?.id ?? null;
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

function currentMonthRange() {
  const start = startOfMonthUtc(new Date());
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  return { start, end };
}
