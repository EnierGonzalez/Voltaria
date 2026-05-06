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

export type OperationalOutletStatus = "available" | "maintenance" | "disabled" | "reserved" | "occupied";

export type AccessOverrideStatus = "allowed" | "blocked" | "suspended" | "limited";

export type OvercurrentAction = "alert_only" | "stop_session";

export type RuleEvaluationResult = "allowed" | "denied";

export type SessionAuditStatus = "valid" | "warning" | "failed" | "needs_review";

export type EnergyAuditStatus =
  | "normal"
  | "zero_consumption"
  | "low_consumption"
  | "suspicious_spike"
  | "missing_meter_values"
  | "meter_mismatch";

export type CommandAuditStatus =
  | "normal"
  | "missing_enable_ack"
  | "missing_disable_ack"
  | "command_timeout";

export type RuleAuditStatus = "normal" | "stopped_by_rule" | "denied_before_start";

export type AuditBillingStatus = "billable" | "not_billable" | "excluded" | "pending_review";

export type BillingCycleStatus = "draft" | "reviewing" | "approved" | "exported" | "closed";

export type BillingCycleItemStatus = "draft" | "approved" | "excluded" | "adjusted";

export type RfidCredentialStatus = "active" | "suspended";

export type CredentialType = "rfid" | "qr" | "pin";

export type CredentialStatus =
  | "active"
  | "disabled"
  | "lost"
  | "stolen"
  | "damaged"
  | "replaced"
  | "expired"
  | "pending_enrollment";

export type CredentialEnrollmentMode = "assign" | "replace";

export type CredentialEnrollmentStatus =
  | "waiting"
  | "captured"
  | "expired"
  | "cancelled"
  | "failed";

export type AuthorizationAttemptResult =
  | "accepted"
  | "rejected"
  | "captured"
  | "expired"
  | "blocked";

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
  operationalStatus?: OperationalOutletStatus;
  operationalStatusLabel?: string;
  allowRfid?: boolean;
  allowMobile?: boolean;
  appliedMaxCurrentAmp?: number;
  appliedMaxSessionDurationMinutes?: number;
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
  activationMethodLabel?: string;
  auditStatus?: SessionAuditStatus;
  auditStatusLabel?: string;
  billingStatus?: AuditBillingStatus;
  billingStatusLabel?: string;
  stopReason?: string;
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

export type SessionAuditSummary = {
  id: string;
  propertyId: PropertyId;
  sessionId: string;
  residentId?: string;
  apartmentId?: string;
  outletId?: string;
  residentName: string;
  apartmentNumber: string;
  outletCode: string;
  sessionStartedAt: string;
  deliveredKwh: number;
  amount: number;
  auditStatus: SessionAuditStatus;
  auditStatusLabel: string;
  energyStatus: EnergyAuditStatus;
  energyStatusLabel: string;
  commandStatus: CommandAuditStatus;
  commandStatusLabel: string;
  ruleStatus: RuleAuditStatus;
  ruleStatusLabel: string;
  billingStatus: AuditBillingStatus;
  billingStatusLabel: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BillingCycleSummary = {
  id: string;
  propertyId: PropertyId;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: BillingCycleStatus;
  statusLabel: string;
  totalKwh: number;
  totalAmount: number;
  totalSessions: number;
  createdAt: string;
  approvedAt?: string;
};

export type BillingCycleItemSummary = {
  id: string;
  billingCycleId: string;
  propertyId: PropertyId;
  residentId?: string;
  apartmentId: string;
  apartmentNumber: string;
  residentName: string;
  totalKwh: number;
  totalAmount: number;
  adjustmentAmount?: number;
  adjustmentReason?: string;
  finalAmount: number;
  totalSessions: number;
  validSessions: number;
  warningSessions: number;
  excludedSessions: number;
  status: BillingCycleItemStatus;
  statusLabel: string;
  notes?: string;
};

export type BillingCycleSessionItemSummary = {
  id: string;
  billingCycleId: string;
  billingCycleItemId: string;
  sessionId: string;
  residentName: string;
  apartmentNumber: string;
  outletCode: string;
  startedAt: string;
  energyDeliveredKwh: number;
  amount: number;
  auditStatus: SessionAuditStatus;
  auditStatusLabel: string;
  billingStatus: AuditBillingStatus;
  billingStatusLabel: string;
  included: boolean;
  exclusionReason?: string;
};

export type BillingCycleDetail = {
  cycle: BillingCycleSummary;
  items: BillingCycleItemSummary[];
  sessions: BillingCycleSessionItemSummary[];
};

export type RfidCredentialSummary = {
  id: string;
  propertyId: PropertyId;
  residentId: string;
  label: string;
  maskedValue: string;
  credentialType: CredentialType;
  status: CredentialStatus;
  statusLabel: string;
  createdAt: string;
  lastUsedAt?: string;
};

export type CredentialEventSummary = {
  id: string;
  action: string;
  reason?: string;
  performedBy?: string;
  createdAt: string;
};

export type RuleEvaluationSummary = {
  id: string;
  propertyId: PropertyId;
  sessionId?: string;
  method: ActivationMethod;
  result: RuleEvaluationResult;
  reason: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type AuthorizationAttemptSummary = {
  id: string;
  propertyId: PropertyId;
  sessionId?: string;
  method: ActivationMethod;
  result: AuthorizationAttemptResult;
  reason?: string;
  maskedValue?: string;
  createdAt: string;
};

export type AccessDeviceSummary = {
  id: string;
  propertyId: PropertyId;
  code: string;
  name: string;
  kind: "rfid_reader" | "rfid_kiosk" | "mobile_app" | "admin_panel";
  status: "online" | "offline" | "disabled";
  locationLabel?: string;
};

export type PropertyAccessRuleSummary = {
  id: string;
  propertyId: PropertyId;
  name: string;
  active: boolean;
  allowRfid: boolean;
  allowMobile: boolean;
  allowAdmin: boolean;
  maxActiveSessionsPerResident: number;
  maxActiveSessionsPerApartment: number;
  maxActiveSessionsProperty?: number;
  maxSessionDurationMinutes?: number;
  maxSessionKwh?: number;
  maxSessionCost?: number;
  startupNoLoadTimeoutSeconds: number;
  noLoadTimeoutSeconds: number;
  lowPowerThresholdWatts: number;
  overcurrentAction: OvercurrentAction;
  defaultMaxCurrentAmp?: number;
};

export type AccessScheduleWindowSummary = {
  id: string;
  propertyId: PropertyId;
  ruleId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
};

export type ResidentAccessRuleSummary = {
  id?: string;
  propertyId: PropertyId;
  residentId: string;
  status: AccessOverrideStatus;
  statusLabel: string;
  allowRfid?: boolean;
  allowMobile?: boolean;
  maxSessionDurationMinutes?: number;
  maxSessionKwh?: number;
  maxSessionsPerDay?: number;
  notes?: string;
};

export type OutletAccessRuleSummary = {
  id?: string;
  propertyId: PropertyId;
  outletId: string;
  status: Exclude<OperationalOutletStatus, "occupied">;
  statusLabel: string;
  allowRfid?: boolean;
  allowMobile?: boolean;
  maxCurrentAmp?: number;
  maxSessionDurationMinutes?: number;
  notes?: string;
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
