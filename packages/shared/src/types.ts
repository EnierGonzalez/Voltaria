export type PropertyId = string;

export type ChargingPointKind = "ocpp_charger" | "controlled_outlet";

export type ControlMode = "simulated" | "mqtt" | "http" | "modbus" | "lorawan";

export type ChargerStatus = "available" | "charging" | "offline" | "faulted" | "reserved";

export type SessionStatus = "pending_start" | "active" | "completed" | "interrupted" | "failed";

export type ActivationMethod = "rfid" | "mobile" | "admin";

export type AlertSeverity = "info" | "warning" | "critical";

export type DeviceCommandType = "enable" | "disable" | "read_status";

export type DeviceCommandStatus = "pending" | "sent" | "acknowledged" | "failed" | "timeout";

export type BillingStatus = "paid" | "pending";

export type AccessStatus = "success" | "warning";

export type RfidCredentialStatus = "active" | "suspended";

export type MobileAccessStatus = "active" | "missing" | "suspended";

export type PropertySummary = {
  id: PropertyId;
  name: string;
  address: string;
  timezone: string;
};

export type ChargerSummary = {
  id: string;
  propertyId: PropertyId;
  kind: ChargingPointKind;
  name: string;
  code: string;
  location: string;
  status: ChargerStatus;
  statusLabel: string;
  connectors: number;
  maxPowerKw: number;
  ocppVersion: "1.6J";
  lastSeenAt: string;
  voltage?: number;
  maxCurrentAmp?: number;
  publicAccessCode?: string;
  controlMode?: ControlMode;
  currentPowerKw?: number;
  currentSessionKwh?: number;
  currentSessionId?: string;
};

export type ControlledOutletSummary = ChargerSummary & {
  kind: "controlled_outlet";
  voltage: number;
  maxCurrentAmp: number;
  publicAccessCode: string;
  controlMode: ControlMode;
  currentPowerKw: number;
  currentSessionKwh: number;
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
  activationMethod?: ActivationMethod;
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

export type MobileAccessCredential = {
  id: string;
  label: string;
  maskedValue: string;
  status: RfidCredentialStatus;
  statusLabel: string;
  residentName: string;
  apartmentNumber: string;
  propertyName: string;
};

export type MobileAccessSummary = {
  status: MobileAccessStatus;
  statusLabel: string;
  credential?: MobileAccessCredential;
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

export type DeviceCommandSummary = {
  id: string;
  chargerId?: string;
  sessionId?: string;
  commandType: DeviceCommandType;
  status: DeviceCommandStatus;
  requestedBy?: string;
  createdAt: string;
  acknowledgedAt?: string;
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
