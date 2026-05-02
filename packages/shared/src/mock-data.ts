import type {
  AlertSummary,
  BillingRecordSummary,
  ChargerSummary,
  ChargingSessionSummary,
  ConsumptionPoint,
  MeterValuePoint,
  OcppLogSummary,
  PropertySummary,
  ResidentSummary,
  SessionEventSummary,
  TariffSummary
} from "./types";

export const mockProperties: PropertySummary[] = [
  {
    id: "prop_aurora",
    name: "Torre Aurora",
    address: "Av. Bonampak 110, Cancún",
    timezone: "America/Cancun"
  }
];

export const towerChargers: ChargerSummary[] = [
  {
    id: "chg_001",
    propertyId: "prop_aurora",
    name: "Cargador P1 Norte",
    code: "AUR-P1-01",
    location: "Parking nivel 1",
    status: "charging",
    statusLabel: "Cargando",
    connectors: 2,
    maxPowerKw: 22,
    ocppVersion: "1.6J",
    lastSeenAt: "2026-05-01T11:24:00-05:00",
    currentSessionId: "ses_001"
  },
  {
    id: "chg_002",
    propertyId: "prop_aurora",
    name: "Cargador P1 Sur",
    code: "AUR-P1-02",
    location: "Parking nivel 1",
    status: "available",
    statusLabel: "Disponible",
    connectors: 2,
    maxPowerKw: 22,
    ocppVersion: "1.6J",
    lastSeenAt: "2026-05-01T11:22:00-05:00"
  },
  {
    id: "chg_003",
    propertyId: "prop_aurora",
    name: "Cargador P2 Este",
    code: "AUR-P2-03",
    location: "Parking nivel 2",
    status: "reserved",
    statusLabel: "Reservado",
    connectors: 1,
    maxPowerKw: 11,
    ocppVersion: "1.6J",
    lastSeenAt: "2026-05-01T11:18:00-05:00"
  },
  {
    id: "chg_004",
    propertyId: "prop_aurora",
    name: "Cargador P2 Oeste",
    code: "AUR-P2-04",
    location: "Parking nivel 2",
    status: "faulted",
    statusLabel: "Falla",
    connectors: 1,
    maxPowerKw: 11,
    ocppVersion: "1.6J",
    lastSeenAt: "2026-05-01T10:41:00-05:00"
  },
  {
    id: "chg_005",
    propertyId: "prop_aurora",
    name: "Cargador Visitantes",
    code: "AUR-VIS-05",
    location: "Bahía visitantes",
    status: "offline",
    statusLabel: "Offline",
    connectors: 1,
    maxPowerKw: 7.4,
    ocppVersion: "1.6J",
    lastSeenAt: "2026-05-01T10:06:00-05:00"
  }
];

export const recentSessions: ChargingSessionSummary[] = [
  {
    id: "ses_001",
    propertyId: "prop_aurora",
    chargerId: "chg_001",
    connectorNumber: 1,
    residentName: "María López",
    apartmentNumber: "1204",
    chargerCode: "AUR-P1-01",
    chargerLocation: "Parking nivel 1",
    deliveredKwh: 18.6,
    durationMinutes: 96,
    powerKw: 11.2,
    costAmount: 102.3,
    tariffName: "Residencial mayo",
    ratePerKwh: 5.5,
    status: "active",
    statusLabel: "Activa",
    startedAt: "2026-05-01T08:10:00-05:00",
    shortDate: "Hoy",
    dateLabel: "1 mayo, 08:10"
  },
  {
    id: "ses_002",
    propertyId: "prop_aurora",
    chargerId: "chg_002",
    connectorNumber: 2,
    residentName: "Carlos Méndez",
    apartmentNumber: "0802",
    chargerCode: "AUR-P1-02",
    chargerLocation: "Parking nivel 1",
    deliveredKwh: 24.4,
    durationMinutes: 143,
    powerKw: 7.8,
    costAmount: 134.2,
    tariffName: "Residencial mayo",
    ratePerKwh: 5.5,
    status: "completed",
    statusLabel: "Completada",
    startedAt: "2026-04-30T21:24:00-05:00",
    endedAt: "2026-04-30T23:47:00-05:00",
    shortDate: "Ayer",
    dateLabel: "30 abril, 21:24"
  },
  {
    id: "ses_003",
    propertyId: "prop_aurora",
    chargerId: "chg_003",
    connectorNumber: 1,
    residentName: "Ana Rivera",
    apartmentNumber: "1501",
    chargerCode: "AUR-P2-03",
    chargerLocation: "Parking nivel 2",
    deliveredKwh: 9.8,
    durationMinutes: 58,
    powerKw: 6.1,
    costAmount: 53.9,
    tariffName: "Residencial mayo",
    ratePerKwh: 5.5,
    status: "completed",
    statusLabel: "Completada",
    startedAt: "2026-04-30T18:05:00-05:00",
    endedAt: "2026-04-30T19:03:00-05:00",
    shortDate: "30 Abr",
    dateLabel: "30 abril, 18:05"
  },
  {
    id: "ses_004",
    propertyId: "prop_aurora",
    chargerId: "chg_004",
    connectorNumber: 1,
    residentName: "Diego Santos",
    apartmentNumber: "0306",
    chargerCode: "AUR-P2-04",
    chargerLocation: "Parking nivel 2",
    deliveredKwh: 6.2,
    durationMinutes: 41,
    powerKw: 5.4,
    costAmount: 34.1,
    tariffName: "Residencial mayo",
    ratePerKwh: 5.5,
    status: "failed",
    statusLabel: "Fallida",
    startedAt: "2026-04-29T07:45:00-05:00",
    endedAt: "2026-04-29T08:26:00-05:00",
    shortDate: "29 Abr",
    dateLabel: "29 abril, 07:45"
  }
];

export const mobileSessions: ChargingSessionSummary[] = recentSessions;

export const residents: ResidentSummary[] = [
  {
    id: "res_001",
    propertyId: "prop_aurora",
    name: "María López",
    firstName: "María",
    initials: "ML",
    email: "maria.lopez@example.com",
    apartmentNumber: "1204",
    propertyName: "Torre Aurora",
    accessStatus: "success",
    accessLabel: "Activo",
    sessionsThisMonth: 8,
    monthlyKwh: 142.8,
    averageKwh: 17.9,
    monthlyCost: 785.4
  },
  {
    id: "res_002",
    propertyId: "prop_aurora",
    name: "Carlos Méndez",
    firstName: "Carlos",
    initials: "CM",
    email: "carlos.mendez@example.com",
    apartmentNumber: "0802",
    propertyName: "Torre Aurora",
    accessStatus: "success",
    accessLabel: "Activo",
    sessionsThisMonth: 6,
    monthlyKwh: 118.4,
    averageKwh: 19.7,
    monthlyCost: 651.2
  },
  {
    id: "res_003",
    propertyId: "prop_aurora",
    name: "Ana Rivera",
    firstName: "Ana",
    initials: "AR",
    email: "ana.rivera@example.com",
    apartmentNumber: "1501",
    propertyName: "Torre Aurora",
    accessStatus: "warning",
    accessLabel: "Pendiente",
    sessionsThisMonth: 3,
    monthlyKwh: 44.6,
    averageKwh: 14.9,
    monthlyCost: 245.3
  },
  {
    id: "res_004",
    propertyId: "prop_aurora",
    name: "Diego Santos",
    firstName: "Diego",
    initials: "DS",
    email: "diego.santos@example.com",
    apartmentNumber: "0306",
    propertyName: "Torre Aurora",
    accessStatus: "success",
    accessLabel: "Activo",
    sessionsThisMonth: 2,
    monthlyKwh: 32.4,
    averageKwh: 16.2,
    monthlyCost: 178.2
  }
];

export const mobileResident = residents[0]!;

export const mobileAccessCredential = {
  id: "cred_rfid_001",
  label: "Tarjeta RFID principal",
  maskedValue: "****A91F",
  status: "active",
  statusLabel: "Activa",
  residentName: mobileResident.name,
  apartmentNumber: mobileResident.apartmentNumber,
  propertyName: mobileResident.propertyName
} as const;

export const mobileAccessSummary = {
  status: "active",
  statusLabel: "Acceso activo",
  credential: mobileAccessCredential
} as const;

export const recentAlerts: AlertSummary[] = [
  {
    id: "alt_001",
    propertyId: "prop_aurora",
    chargerId: "chg_004",
    sessionId: "ses_004",
    title: "Conector con falla",
    description: "AUR-P2-04 reportó Faulted durante una sesión.",
    severity: "critical",
    severityLabel: "Crítica",
    source: "OCPP StatusNotification"
  },
  {
    id: "alt_002",
    propertyId: "prop_aurora",
    chargerId: "chg_005",
    title: "Cargador sin heartbeat",
    description: "AUR-VIS-05 no ha enviado heartbeat en 18 minutos.",
    severity: "warning",
    severityLabel: "Warning",
    source: "OCPP Heartbeat"
  },
  {
    id: "alt_003",
    propertyId: "prop_aurora",
    title: "Tarifa actualizada",
    description: "La tarifa residencial entró en vigencia para mayo.",
    severity: "info",
    severityLabel: "Info",
    source: "Billing"
  }
];

export const billingRecords: BillingRecordSummary[] = [
  {
    id: "bil_001",
    propertyId: "prop_aurora",
    period: "Mayo 2026",
    apartmentNumber: "1204",
    residentName: "María López",
    kwh: 142.8,
    ratePerKwh: 5.5,
    totalAmount: 785.4,
    status: "pending",
    statusLabel: "Pendiente"
  },
  {
    id: "bil_002",
    propertyId: "prop_aurora",
    period: "Mayo 2026",
    apartmentNumber: "0802",
    residentName: "Carlos Méndez",
    kwh: 118.4,
    ratePerKwh: 5.5,
    totalAmount: 651.2,
    status: "pending",
    statusLabel: "Pendiente"
  },
  {
    id: "bil_003",
    propertyId: "prop_aurora",
    period: "Abril 2026",
    apartmentNumber: "1501",
    residentName: "Ana Rivera",
    kwh: 97.2,
    ratePerKwh: 5.35,
    totalAmount: 520.02,
    status: "paid",
    statusLabel: "Pagado"
  }
];

export const consumptionSeries: ConsumptionPoint[] = [
  { label: "Lun", date: "2026-04-27", kwh: 82, sessions: 9, costAmount: 451 },
  { label: "Mar", date: "2026-04-28", kwh: 96, sessions: 11, costAmount: 528 },
  { label: "Mié", date: "2026-04-29", kwh: 74, sessions: 8, costAmount: 407 },
  { label: "Jue", date: "2026-04-30", kwh: 122, sessions: 14, costAmount: 671 },
  { label: "Vie", date: "2026-05-01", kwh: 138, sessions: 16, costAmount: 759 },
  { label: "Sáb", date: "2026-05-02", kwh: 104, sessions: 12, costAmount: 572 },
  { label: "Dom", date: "2026-05-03", kwh: 89, sessions: 10, costAmount: 489.5 }
];

export const weeklyConsumptionSeries: ConsumptionPoint[] = [
  { label: "Sem 14", date: "2026-04-06", kwh: 612, sessions: 67, costAmount: 3366 },
  { label: "Sem 15", date: "2026-04-13", kwh: 684, sessions: 74, costAmount: 3762 },
  { label: "Sem 16", date: "2026-04-20", kwh: 721, sessions: 81, costAmount: 3965.5 },
  { label: "Sem 17", date: "2026-04-27", kwh: 705, sessions: 80, costAmount: 3877.5 }
];

export const monthlyConsumptionSeries: ConsumptionPoint[] = [
  { label: "Ene", date: "2026-01-01", kwh: 1260, sessions: 132, costAmount: 6738 },
  { label: "Feb", date: "2026-02-01", kwh: 1314, sessions: 141, costAmount: 7029.9 },
  { label: "Mar", date: "2026-03-01", kwh: 1398, sessions: 149, costAmount: 7479.3 },
  { label: "Abr", date: "2026-04-01", kwh: 1462, sessions: 158, costAmount: 8041 },
  { label: "May", date: "2026-05-01", kwh: 1482.6, sessions: 162, costAmount: 8154.3 }
];

export const mobileWeeklyStatsSeries: ConsumptionPoint[] = [
  { label: "Lun", date: "2026-04-27", kwh: 14.4, sessions: 1, costAmount: 79.2 },
  { label: "Mar", date: "2026-04-28", kwh: 0, sessions: 0, costAmount: 0 },
  { label: "Mié", date: "2026-04-29", kwh: 16.7, sessions: 1, costAmount: 91.85 },
  { label: "Jue", date: "2026-04-30", kwh: 24.4, sessions: 1, costAmount: 134.2 },
  { label: "Vie", date: "2026-05-01", kwh: 18.6, sessions: 1, costAmount: 102.3 },
  { label: "Sáb", date: "2026-05-02", kwh: 0, sessions: 0, costAmount: 0 },
  { label: "Dom", date: "2026-05-03", kwh: 0, sessions: 0, costAmount: 0 }
];

export const mobileMonthlyStatsSeries: ConsumptionPoint[] = [
  { label: "Sem 1", date: "2026-04-06", kwh: 36.2, sessions: 2, costAmount: 199.1 },
  { label: "Sem 2", date: "2026-04-13", kwh: 42.8, sessions: 2, costAmount: 235.4 },
  { label: "Sem 3", date: "2026-04-20", kwh: 45.2, sessions: 3, costAmount: 248.6 },
  { label: "Sem 4", date: "2026-04-27", kwh: 18.6, sessions: 1, costAmount: 102.3 }
];

export const tariffs: TariffSummary[] = [
  {
    id: "tar_001",
    propertyId: "prop_aurora",
    name: "Residencial mayo",
    ratePerKwh: 5.5,
    currency: "MXN"
  }
];

export const dashboardStats = {
  monthlyKwh: 1482.6,
  monthlyRevenue: 8154.3,
  activeSessions: 4,
  availableConnectors: 5,
  billingReady: 19,
  openAlerts: 3,
  currentPowerKw: 38.4,
  averageSessionMinutes: 84,
  activeResidents: 42
};

export const ocppLogs: OcppLogSummary[] = [
  {
    id: "ocpp_001",
    chargerId: "chg_001",
    sessionId: "ses_001",
    direction: "inbound",
    action: "StartTransaction",
    messageTypeId: 2,
    uniqueId: "start-984",
    payloadSummary: "connectorId 1 · meterStart 184220 Wh",
    createdAt: "2026-05-01T08:10:03-05:00"
  },
  {
    id: "ocpp_002",
    chargerId: "chg_001",
    sessionId: "ses_001",
    direction: "outbound",
    action: "StartTransaction.conf",
    messageTypeId: 3,
    uniqueId: "start-984",
    payloadSummary: "transactionId 88421 · Accepted",
    createdAt: "2026-05-01T08:10:04-05:00"
  },
  {
    id: "ocpp_003",
    chargerId: "chg_001",
    sessionId: "ses_001",
    direction: "inbound",
    action: "MeterValues",
    messageTypeId: 2,
    uniqueId: "meter-991",
    payloadSummary: "11.2 kW · 18.6 kWh entregados",
    createdAt: "2026-05-01T09:46:00-05:00"
  },
  {
    id: "ocpp_004",
    chargerId: "chg_004",
    sessionId: "ses_004",
    direction: "inbound",
    action: "StatusNotification",
    messageTypeId: 2,
    uniqueId: "status-414",
    payloadSummary: "connectorId 1 · Faulted · GroundFailure",
    createdAt: "2026-04-29T08:26:19-05:00"
  },
  {
    id: "ocpp_005",
    chargerId: "chg_005",
    direction: "inbound",
    action: "Heartbeat",
    messageTypeId: 2,
    uniqueId: "heart-736",
    payloadSummary: "Último heartbeat recibido",
    createdAt: "2026-05-01T10:06:00-05:00"
  }
];

export const sessionEvents: SessionEventSummary[] = [
  {
    id: "evt_001",
    sessionId: "ses_001",
    label: "Autorización",
    description: "Credencial RFID validada para María López.",
    occurredAt: "2026-05-01T08:09:58-05:00",
    tone: "success"
  },
  {
    id: "evt_002",
    sessionId: "ses_001",
    label: "Inicio",
    description: "Sesión iniciada en AUR-P1-01 con conector 1.",
    occurredAt: "2026-05-01T08:10:03-05:00",
    tone: "info"
  },
  {
    id: "evt_003",
    sessionId: "ses_001",
    label: "Medición",
    description: "Potencia actual estable alrededor de 11.2 kW.",
    occurredAt: "2026-05-01T09:46:00-05:00",
    tone: "info"
  },
  {
    id: "evt_004",
    sessionId: "ses_004",
    label: "Falla",
    description: "El cargador reportó Faulted y la sesión fue detenida.",
    occurredAt: "2026-04-29T08:26:19-05:00",
    tone: "critical"
  }
];

export const meterValueSeries: Record<string, MeterValuePoint[]> = {
  ses_001: [
    { label: "08:10", sampledAt: "2026-05-01T08:10:00-05:00", energyKwh: 0, powerKw: 0.8 },
    { label: "08:30", sampledAt: "2026-05-01T08:30:00-05:00", energyKwh: 3.8, powerKw: 10.9 },
    { label: "08:50", sampledAt: "2026-05-01T08:50:00-05:00", energyKwh: 7.6, powerKw: 11.1 },
    { label: "09:10", sampledAt: "2026-05-01T09:10:00-05:00", energyKwh: 11.2, powerKw: 11.4 },
    { label: "09:30", sampledAt: "2026-05-01T09:30:00-05:00", energyKwh: 15.2, powerKw: 11.2 },
    { label: "09:46", sampledAt: "2026-05-01T09:46:00-05:00", energyKwh: 18.6, powerKw: 11.2 }
  ],
  ses_002: [
    { label: "21:24", sampledAt: "2026-04-30T21:24:00-05:00", energyKwh: 0, powerKw: 0.7 },
    { label: "22:00", sampledAt: "2026-04-30T22:00:00-05:00", energyKwh: 7.4, powerKw: 7.6 },
    { label: "22:40", sampledAt: "2026-04-30T22:40:00-05:00", energyKwh: 17.8, powerKw: 8.1 },
    { label: "23:47", sampledAt: "2026-04-30T23:47:00-05:00", energyKwh: 24.4, powerKw: 7.8 }
  ],
  ses_003: [
    { label: "18:05", sampledAt: "2026-04-30T18:05:00-05:00", energyKwh: 0, powerKw: 0.6 },
    { label: "18:25", sampledAt: "2026-04-30T18:25:00-05:00", energyKwh: 3.4, powerKw: 6.2 },
    { label: "18:45", sampledAt: "2026-04-30T18:45:00-05:00", energyKwh: 7.1, powerKw: 6.1 },
    { label: "19:03", sampledAt: "2026-04-30T19:03:00-05:00", energyKwh: 9.8, powerKw: 5.8 }
  ],
  ses_004: [
    { label: "07:45", sampledAt: "2026-04-29T07:45:00-05:00", energyKwh: 0, powerKw: 0.5 },
    { label: "08:00", sampledAt: "2026-04-29T08:00:00-05:00", energyKwh: 2.2, powerKw: 5.6 },
    { label: "08:15", sampledAt: "2026-04-29T08:15:00-05:00", energyKwh: 4.8, powerKw: 5.4 },
    { label: "08:26", sampledAt: "2026-04-29T08:26:00-05:00", energyKwh: 6.2, powerKw: 0 }
  ]
};
