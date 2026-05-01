export type PropertyId = string;

export type ChargerStatus = "available" | "charging" | "offline" | "faulted" | "reserved";

export type SessionStatus = "active" | "completed" | "interrupted" | "failed";

export type AlertSeverity = "info" | "warning" | "critical";

export type BillingStatus = "paid" | "pending";

export type AccessStatus = "success" | "warning";

export type PropertySummary = {
  id: PropertyId;
  name: string;
  address: string;
  timezone: string;
};

export type ChargerSummary = {
  id: string;
  propertyId: PropertyId;
  name: string;
  code: string;
  location: string;
  status: ChargerStatus;
  statusLabel: string;
  connectors: number;
  maxPowerKw: number;
  ocppVersion: "1.6J";
  lastSeenAt: string;
  currentSessionId?: string;
};

export type ChargingSessionSummary = {
  id: string;
  propertyId: PropertyId;
  chargerId: string;
  connectorNumber: number;
  residentName: string;
  apartmentNumber: string;
  chargerCode: string;
  chargerLocation: string;
  deliveredKwh: number;
  durationMinutes: number;
  powerKw: number;
  costAmount: number;
  tariffName: string;
  ratePerKwh: number;
  status: SessionStatus;
  statusLabel: string;
  startedAt: string;
  endedAt?: string;
  shortDate: string;
  dateLabel: string;
};

export type ResidentSummary = {
  id: string;
  propertyId: PropertyId;
  name: string;
  firstName: string;
  initials: string;
  email: string;
  apartmentNumber: string;
  propertyName: string;
  accessStatus: AccessStatus;
  accessLabel: string;
  sessionsThisMonth: number;
  monthlyKwh: number;
  averageKwh: number;
  monthlyCost: number;
};

export type AlertSummary = {
  id: string;
  propertyId: PropertyId;
  chargerId?: string;
  sessionId?: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  severityLabel: string;
  source: string;
};

export type BillingRecordSummary = {
  id: string;
  propertyId: PropertyId;
  period: string;
  apartmentNumber: string;
  residentName: string;
  kwh: number;
  ratePerKwh: number;
  totalAmount: number;
  status: BillingStatus;
  statusLabel: string;
};

export type ConsumptionPoint = {
  label: string;
  date: string;
  kwh: number;
  sessions: number;
  costAmount: number;
};

export type TariffSummary = {
  id: string;
  propertyId: PropertyId;
  name: string;
  ratePerKwh: number;
  currency: string;
};

export type OcppMessageTypeId = 2 | 3 | 4;

export type OcppCall = [2, string, string, Record<string, unknown>];

export type OcppCallResult = [3, string, Record<string, unknown>];

export type OcppCallError = [4, string, string, string, Record<string, unknown>];

export type OcppMessage = OcppCall | OcppCallResult | OcppCallError;

export type OcppLogSummary = {
  id: string;
  chargerId: string;
  sessionId?: string;
  direction: "inbound" | "outbound";
  action: string;
  messageTypeId: OcppMessageTypeId;
  uniqueId: string;
  payloadSummary: string;
  createdAt: string;
};

export type SessionEventSummary = {
  id: string;
  sessionId: string;
  label: string;
  description: string;
  occurredAt: string;
  tone: "info" | "success" | "warning" | "critical";
};

export type MeterValuePoint = {
  label: string;
  sampledAt: string;
  energyKwh: number;
  powerKw: number;
};
