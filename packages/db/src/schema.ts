import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const chargerStatusEnum = pgEnum("charger_status", [
  "available",
  "charging",
  "offline",
  "faulted",
  "reserved"
]);

export const connectorStatusEnum = pgEnum("connector_status", [
  "available",
  "occupied",
  "charging",
  "faulted",
  "unavailable",
  "reserved"
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "pending_start",
  "active",
  "completed",
  "interrupted",
  "failed"
]);

export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical"]);

export const alertStatusEnum = pgEnum("alert_status", ["open", "acknowledged", "resolved"]);

export const billingStatusEnum = pgEnum("billing_status", ["draft", "pending", "paid", "void"]);

export const ocppDirectionEnum = pgEnum("ocpp_direction", ["inbound", "outbound"]);

export const chargingPointKindEnum = pgEnum("charging_point_kind", [
  "ocpp_charger",
  "controlled_outlet"
]);

export const controlModeEnum = pgEnum("control_mode", [
  "simulated",
  "mqtt",
  "http",
  "modbus",
  "lorawan"
]);

export const activationMethodEnum = pgEnum("activation_method", ["rfid", "mobile", "admin"]);

export const deviceCommandTypeEnum = pgEnum("device_command_type", [
  "enable",
  "disable",
  "read_status"
]);

export const deviceCommandStatusEnum = pgEnum("device_command_status", [
  "pending",
  "sent",
  "acknowledged",
  "failed",
  "timeout"
]);

export const systemEventSeverityEnum = pgEnum("system_event_severity", [
  "info",
  "warning",
  "critical"
]);

export const credentialStatusEnum = pgEnum("credential_status", [
  "active",
  "disabled",
  "lost",
  "stolen",
  "damaged",
  "replaced",
  "expired",
  "pending_enrollment"
]);

export const credentialEnrollmentModeEnum = pgEnum("credential_enrollment_mode", [
  "assign",
  "replace"
]);

export const credentialEnrollmentStatusEnum = pgEnum("credential_enrollment_status", [
  "waiting",
  "captured",
  "expired",
  "cancelled",
  "failed"
]);

export const accessDeviceKindEnum = pgEnum("access_device_kind", [
  "rfid_reader",
  "rfid_kiosk",
  "mobile_app",
  "admin_panel"
]);

export const accessDeviceStatusEnum = pgEnum("access_device_status", [
  "online",
  "offline",
  "disabled"
]);

export const authorizationAttemptResultEnum = pgEnum("authorization_attempt_result", [
  "accepted",
  "rejected",
  "captured",
  "expired",
  "blocked"
]);

export const overcurrentActionEnum = pgEnum("overcurrent_action", [
  "alert_only",
  "stop_session"
]);

export const outletAccessStatusEnum = pgEnum("outlet_access_status", [
  "available",
  "maintenance",
  "disabled",
  "reserved"
]);

export const accessOverrideStatusEnum = pgEnum("access_override_status", [
  "allowed",
  "blocked",
  "suspended",
  "limited"
]);

export const ruleEvaluationResultEnum = pgEnum("rule_evaluation_result", [
  "allowed",
  "denied"
]);

export const sessionAuditStatusEnum = pgEnum("session_audit_status", [
  "valid",
  "warning",
  "failed",
  "needs_review"
]);

export const energyAuditStatusEnum = pgEnum("energy_audit_status", [
  "normal",
  "zero_consumption",
  "low_consumption",
  "suspicious_spike",
  "missing_meter_values",
  "meter_mismatch"
]);

export const commandAuditStatusEnum = pgEnum("command_audit_status", [
  "normal",
  "missing_enable_ack",
  "missing_disable_ack",
  "command_timeout"
]);

export const ruleAuditStatusEnum = pgEnum("rule_audit_status", [
  "normal",
  "stopped_by_rule",
  "denied_before_start"
]);

export const auditBillingStatusEnum = pgEnum("audit_billing_status", [
  "billable",
  "not_billable",
  "excluded",
  "pending_review"
]);

export const billingCycleStatusEnum = pgEnum("billing_cycle_status", [
  "draft",
  "reviewing",
  "approved",
  "exported",
  "closed"
]);

export const billingCycleItemStatusEnum = pgEnum("billing_cycle_item_status", [
  "draft",
  "approved",
  "excluded",
  "adjusted"
]);

export const exportJobTypeEnum = pgEnum("export_job_type", [
  "billing_csv",
  "sessions_csv",
  "audit_csv"
]);

export const exportJobStatusEnum = pgEnum("export_job_status", [
  "pending",
  "completed",
  "failed"
]);

export const appUserStatusEnum = pgEnum("app_user_status", [
  "active",
  "invited",
  "suspended",
  "disabled"
]);

export const appUserTypeEnum = pgEnum("app_user_type", ["staff", "resident", "service"]);

export const appUserRoleEnum = pgEnum("app_user_role", [
  "owner",
  "admin",
  "operations",
  "accounting",
  "auditor",
  "resident",
  "support"
]);

export const userMembershipStatusEnum = pgEnum("user_membership_status", [
  "active",
  "invited",
  "suspended",
  "disabled"
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  address: text("address"),
  timezone: varchar("timezone", { length: 80 }).default("America/Cancun").notNull(),
  billingCurrency: varchar("billing_currency", { length: 3 }).default("MXN").notNull(),
  ...timestamps
});

export const apartments = pgTable(
  "apartments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    tower: varchar("tower", { length: 80 }),
    number: varchar("number", { length: 40 }).notNull(),
    floor: integer("floor"),
    ...timestamps
  },
  (table) => ({
    propertyNumberIdx: uniqueIndex("apartments_property_number_idx").on(
      table.propertyId,
      table.tower,
      table.number
    )
  })
);

export const residents = pgTable(
  "residents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    apartmentId: uuid("apartment_id").references(() => apartments.id, { onDelete: "set null" }),
    fullName: varchar("full_name", { length: 180 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps
  },
  (table) => ({
    propertyEmailIdx: uniqueIndex("residents_property_email_idx").on(table.propertyId, table.email),
    propertyIdx: index("residents_property_idx").on(table.propertyId)
  })
);

export const residentCredentials = pgTable(
  "resident_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id")
      .references(() => residents.id, { onDelete: "cascade" })
      .notNull(),
    providerKey: varchar("provider_key", { length: 80 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 220 }).notNull(),
    credentialType: varchar("credential_type", { length: 80 }).default("passwordless").notNull(),
    label: varchar("label", { length: 120 }),
    hashedValue: text("hashed_value"),
    maskedValue: varchar("masked_value", { length: 80 }),
    status: credentialStatusEnum("status").default("active").notNull(),
    passwordHash: text("password_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    replacedByCredentialId: uuid("replaced_by_credential_id").references(
      (): AnyPgColumn => residentCredentials.id,
      { onDelete: "set null" }
    ),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    providerSubjectIdx: uniqueIndex("resident_credentials_provider_subject_idx").on(
      table.providerKey,
      table.providerSubject
    ),
    residentIdx: index("resident_credentials_resident_idx").on(table.residentId),
    propertyResidentIdx: index("resident_credentials_property_resident_idx").on(
      table.propertyId,
      table.residentId
    ),
    propertyTypeStatusIdx: index("resident_credentials_property_type_status_idx").on(
      table.propertyId,
      table.credentialType,
      table.status
    ),
    propertyHashedIdx: index("resident_credentials_property_hashed_idx").on(
      table.propertyId,
      table.hashedValue
    ),
    activeRfidHashIdx: uniqueIndex("resident_credentials_active_rfid_hash_idx")
      .on(table.propertyId, table.hashedValue)
      .where(sql`${table.credentialType} = 'rfid' and ${table.status} = 'active'`)
  })
);

export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 180 }).notNull(),
    fullName: varchar("full_name", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    status: appUserStatusEnum("status").default("active").notNull(),
    userType: appUserTypeEnum("user_type").default("staff").notNull(),
    passwordHash: text("password_hash"),
    mustChangePassword: boolean("must_change_password").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    emailIdx: uniqueIndex("app_users_email_idx").on(table.email),
    statusIdx: index("app_users_status_idx").on(table.status)
  })
);

export const userPropertyMemberships = pgTable(
  "user_property_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => appUsers.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id").references(() => residents.id, { onDelete: "set null" }),
    apartmentId: uuid("apartment_id").references(() => apartments.id, { onDelete: "set null" }),
    role: appUserRoleEnum("role").notNull(),
    status: userMembershipStatusEnum("status").default("active").notNull(),
    ...timestamps
  },
  (table) => ({
    userPropertyIdx: uniqueIndex("user_property_memberships_user_property_idx").on(
      table.userId,
      table.propertyId
    ),
    propertyRoleStatusIdx: index("user_property_memberships_property_role_status_idx").on(
      table.propertyId,
      table.role,
      table.status
    ),
    residentIdx: index("user_property_memberships_resident_idx").on(table.residentId)
  })
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => appUsers.id, { onDelete: "cascade" })
      .notNull(),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => ({
    tokenIdx: uniqueIndex("user_sessions_token_idx").on(table.sessionTokenHash),
    userExpiresIdx: index("user_sessions_user_expires_idx").on(table.userId, table.expiresAt),
    activeIdx: index("user_sessions_active_idx").on(table.expiresAt, table.revokedAt)
  })
);

export const userAuditEvents = pgTable(
  "user_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => appUsers.id, { onDelete: "set null" }),
    targetUserId: uuid("target_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    reason: varchar("reason", { length: 180 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    propertyCreatedIdx: index("user_audit_events_property_created_idx").on(
      table.propertyId,
      table.createdAt
    ),
    userCreatedIdx: index("user_audit_events_user_created_idx").on(table.userId, table.createdAt),
    targetUserCreatedIdx: index("user_audit_events_target_user_created_idx").on(
      table.targetUserId,
      table.createdAt
    )
  })
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => appUsers.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    tokenIdx: uniqueIndex("password_reset_tokens_token_idx").on(table.tokenHash),
    userExpiresIdx: index("password_reset_tokens_user_expires_idx").on(table.userId, table.expiresAt)
  })
);

export const chargers = pgTable(
  "chargers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    kind: chargingPointKindEnum("kind").default("ocpp_charger").notNull(),
    ocppIdentity: varchar("ocpp_identity", { length: 120 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    location: varchar("location", { length: 160 }),
    vendor: varchar("vendor", { length: 120 }),
    model: varchar("model", { length: 120 }),
    serialNumber: varchar("serial_number", { length: 120 }),
    firmwareVersion: varchar("firmware_version", { length: 120 }),
    status: chargerStatusEnum("status").default("offline").notNull(),
    voltage: integer("voltage"),
    maxCurrentAmp: numeric("max_current_amp", { precision: 8, scale: 2 }),
    maxPowerKw: numeric("max_power_kw", { precision: 8, scale: 2 }),
    publicAccessCode: varchar("public_access_code", { length: 120 }),
    controlMode: controlModeEnum("control_mode").default("simulated").notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    propertyIdentityIdx: uniqueIndex("chargers_property_identity_idx").on(
      table.propertyId,
      table.ocppIdentity
    ),
    propertyStatusIdx: index("chargers_property_status_idx").on(table.propertyId, table.status),
    publicAccessCodeIdx: uniqueIndex("chargers_public_access_code_idx").on(table.publicAccessCode)
  })
);

export const chargerConnectors = pgTable(
  "charger_connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    chargerId: uuid("charger_id")
      .references(() => chargers.id, { onDelete: "cascade" })
      .notNull(),
    connectorNumber: integer("connector_number").notNull(),
    status: connectorStatusEnum("status").default("available").notNull(),
    maxPowerKw: numeric("max_power_kw", { precision: 8, scale: 2 }),
    lastStatusAt: timestamp("last_status_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    chargerConnectorIdx: uniqueIndex("charger_connectors_unique_idx").on(
      table.chargerId,
      table.connectorNumber
    ),
    propertyIdx: index("charger_connectors_property_idx").on(table.propertyId)
  })
);

export const chargingSessions = pgTable(
  "charging_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    chargerId: uuid("charger_id")
      .references(() => chargers.id, { onDelete: "restrict" })
      .notNull(),
    connectorId: uuid("connector_id").references(() => chargerConnectors.id, {
      onDelete: "restrict"
    }),
    residentId: uuid("resident_id").references(() => residents.id, { onDelete: "set null" }),
    apartmentId: uuid("apartment_id").references(() => apartments.id, { onDelete: "set null" }),
    ocppTransactionId: integer("ocpp_transaction_id"),
    activationMethod: activationMethodEnum("activation_method"),
    status: sessionStatusEnum("status").default("active").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    meterStartWh: integer("meter_start_wh"),
    meterStopWh: integer("meter_stop_wh"),
    energyKwh: numeric("energy_kwh", { precision: 12, scale: 3 }).default("0").notNull(),
    peakPowerKw: numeric("peak_power_kw", { precision: 8, scale: 2 }),
    averagePowerKw: numeric("average_power_kw", { precision: 8, scale: 2 }),
    costAmount: numeric("cost_amount", { precision: 12, scale: 2 }).default("0").notNull(),
    currency: varchar("currency", { length: 3 }).default("MXN").notNull(),
    stopReason: varchar("stop_reason", { length: 120 }),
    ...timestamps
  },
  (table) => ({
    propertyStartedIdx: index("charging_sessions_property_started_idx").on(
      table.propertyId,
      table.startedAt
    ),
    chargerStatusIdx: index("charging_sessions_charger_status_idx").on(table.chargerId, table.status),
    transactionIdx: uniqueIndex("charging_sessions_ocpp_transaction_idx").on(
      table.chargerId,
      table.ocppTransactionId
    )
  })
);

export const deviceCommands = pgTable(
  "device_commands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    chargerId: uuid("charger_id").references(() => chargers.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => chargingSessions.id, { onDelete: "set null" }),
    commandType: deviceCommandTypeEnum("command_type").notNull(),
    status: deviceCommandStatusEnum("status").default("pending").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    requestedBy: varchar("requested_by", { length: 120 }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    propertyStatusIdx: index("device_commands_property_status_idx").on(
      table.propertyId,
      table.status
    ),
    chargerCreatedIdx: index("device_commands_charger_created_idx").on(
      table.chargerId,
      table.createdAt
    )
  })
);

export const accessDevices = pgTable(
  "access_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    kind: accessDeviceKindEnum("kind").notNull(),
    locationLabel: varchar("location_label", { length: 160 }),
    linkedOutletId: uuid("linked_outlet_id").references(() => chargers.id, { onDelete: "set null" }),
    status: accessDeviceStatusEnum("status").default("offline").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps
  },
  (table) => ({
    propertyCodeIdx: uniqueIndex("access_devices_property_code_idx").on(
      table.propertyId,
      table.code
    ),
    propertyStatusIdx: index("access_devices_property_status_idx").on(table.propertyId, table.status)
  })
);

export const credentialEnrollmentSessions = pgTable(
  "credential_enrollment_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id")
      .references(() => residents.id, { onDelete: "cascade" })
      .notNull(),
    oldCredentialId: uuid("old_credential_id").references(() => residentCredentials.id, {
      onDelete: "set null"
    }),
    accessDeviceId: uuid("access_device_id").references(() => accessDevices.id, {
      onDelete: "set null"
    }),
    outletId: uuid("outlet_id").references(() => chargers.id, { onDelete: "set null" }),
    mode: credentialEnrollmentModeEnum("mode").notNull(),
    status: credentialEnrollmentStatusEnum("status").default("waiting").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    capturedMaskedValue: varchar("captured_masked_value", { length: 80 }),
    createdBy: varchar("created_by", { length: 120 }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps
  },
  (table) => ({
    propertyStatusExpiresIdx: index("credential_enrollments_property_status_expires_idx").on(
      table.propertyId,
      table.status,
      table.expiresAt
    ),
    residentIdx: index("credential_enrollments_resident_idx").on(table.residentId)
  })
);

export const credentialEvents = pgTable(
  "credential_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id").references(() => residents.id, { onDelete: "set null" }),
    credentialId: uuid("credential_id").references(() => residentCredentials.id, {
      onDelete: "set null"
    }),
    enrollmentId: uuid("enrollment_id").references(() => credentialEnrollmentSessions.id, {
      onDelete: "set null"
    }),
    action: varchar("action", { length: 120 }).notNull(),
    reason: varchar("reason", { length: 160 }),
    performedBy: varchar("performed_by", { length: 120 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    propertyCreatedIdx: index("credential_events_property_created_idx").on(
      table.propertyId,
      table.createdAt
    ),
    credentialIdx: index("credential_events_credential_idx").on(table.credentialId),
    residentIdx: index("credential_events_resident_idx").on(table.residentId)
  })
);

export const authorizationAttempts = pgTable(
  "authorization_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id").references(() => residents.id, { onDelete: "set null" }),
    credentialId: uuid("credential_id").references(() => residentCredentials.id, {
      onDelete: "set null"
    }),
    accessDeviceId: uuid("access_device_id").references(() => accessDevices.id, {
      onDelete: "set null"
    }),
    chargerId: uuid("charger_id").references(() => chargers.id, { onDelete: "set null" }),
    method: activationMethodEnum("method").notNull(),
    result: authorizationAttemptResultEnum("result").notNull(),
    reason: varchar("reason", { length: 160 }),
    maskedValue: varchar("masked_value", { length: 80 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    propertyCreatedIdx: index("authorization_attempts_property_created_idx").on(
      table.propertyId,
      table.createdAt
    ),
    credentialIdx: index("authorization_attempts_credential_idx").on(table.credentialId)
  })
);

export const propertyAccessRules = pgTable(
  "property_access_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    active: boolean("active").default(true).notNull(),
    allowRfid: boolean("allow_rfid").default(true).notNull(),
    allowMobile: boolean("allow_mobile").default(true).notNull(),
    allowAdmin: boolean("allow_admin").default(true).notNull(),
    maxActiveSessionsPerResident: integer("max_active_sessions_per_resident").default(1).notNull(),
    maxActiveSessionsPerApartment: integer("max_active_sessions_per_apartment").default(2).notNull(),
    maxActiveSessionsProperty: integer("max_active_sessions_property"),
    maxSessionDurationMinutes: integer("max_session_duration_minutes"),
    maxSessionKwh: numeric("max_session_kwh", { precision: 12, scale: 3 }),
    maxSessionCost: numeric("max_session_cost", { precision: 12, scale: 2 }),
    startupNoLoadTimeoutSeconds: integer("startup_no_load_timeout_seconds").default(90).notNull(),
    noLoadTimeoutSeconds: integer("no_load_timeout_seconds").default(600).notNull(),
    lowPowerThresholdWatts: numeric("low_power_threshold_watts", { precision: 10, scale: 2 })
      .default("20")
      .notNull(),
    overcurrentAction: overcurrentActionEnum("overcurrent_action")
      .default("stop_session")
      .notNull(),
    defaultMaxCurrentAmp: numeric("default_max_current_amp", { precision: 8, scale: 2 }),
    ...timestamps
  },
  (table) => ({
    propertyActiveIdx: index("property_access_rules_property_active_idx").on(
      table.propertyId,
      table.active
    )
  })
);

export const accessScheduleWindows = pgTable(
  "access_schedule_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    ruleId: uuid("rule_id").references(() => propertyAccessRules.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps
  },
  (table) => ({
    propertyDayIdx: index("access_schedule_windows_property_day_idx").on(
      table.propertyId,
      table.dayOfWeek
    ),
    ruleIdx: index("access_schedule_windows_rule_idx").on(table.ruleId)
  })
);

export const outletAccessOverrides = pgTable(
  "outlet_access_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    outletId: uuid("outlet_id")
      .references(() => chargers.id, { onDelete: "cascade" })
      .notNull(),
    status: outletAccessStatusEnum("status").default("available").notNull(),
    allowRfid: boolean("allow_rfid"),
    allowMobile: boolean("allow_mobile"),
    maxCurrentAmp: numeric("max_current_amp", { precision: 8, scale: 2 }),
    maxSessionDurationMinutes: integer("max_session_duration_minutes"),
    notes: text("notes"),
    ...timestamps
  },
  (table) => ({
    propertyOutletIdx: uniqueIndex("outlet_access_overrides_property_outlet_idx").on(
      table.propertyId,
      table.outletId
    ),
    propertyStatusIdx: index("outlet_access_overrides_property_status_idx").on(
      table.propertyId,
      table.status
    )
  })
);

export const residentAccessOverrides = pgTable(
  "resident_access_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id")
      .references(() => residents.id, { onDelete: "cascade" })
      .notNull(),
    status: accessOverrideStatusEnum("status").default("allowed").notNull(),
    allowRfid: boolean("allow_rfid"),
    allowMobile: boolean("allow_mobile"),
    maxSessionDurationMinutes: integer("max_session_duration_minutes"),
    maxSessionKwh: numeric("max_session_kwh", { precision: 12, scale: 3 }),
    maxSessionsPerDay: integer("max_sessions_per_day"),
    notes: text("notes"),
    ...timestamps
  },
  (table) => ({
    propertyResidentIdx: uniqueIndex("resident_access_overrides_property_resident_idx").on(
      table.propertyId,
      table.residentId
    ),
    propertyStatusIdx: index("resident_access_overrides_property_status_idx").on(
      table.propertyId,
      table.status
    )
  })
);

export const apartmentAccessOverrides = pgTable(
  "apartment_access_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    apartmentId: uuid("apartment_id")
      .references(() => apartments.id, { onDelete: "cascade" })
      .notNull(),
    status: accessOverrideStatusEnum("status").default("allowed").notNull(),
    maxActiveSessions: integer("max_active_sessions"),
    maxMonthlyKwh: numeric("max_monthly_kwh", { precision: 12, scale: 3 }),
    notes: text("notes"),
    ...timestamps
  },
  (table) => ({
    propertyApartmentIdx: uniqueIndex("apartment_access_overrides_property_apartment_idx").on(
      table.propertyId,
      table.apartmentId
    ),
    propertyStatusIdx: index("apartment_access_overrides_property_status_idx").on(
      table.propertyId,
      table.status
    )
  })
);

export const ruleEvaluations = pgTable(
  "rule_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id").references(() => residents.id, { onDelete: "set null" }),
    apartmentId: uuid("apartment_id").references(() => apartments.id, { onDelete: "set null" }),
    outletId: uuid("outlet_id").references(() => chargers.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => chargingSessions.id, { onDelete: "set null" }),
    method: activationMethodEnum("method").notNull(),
    result: ruleEvaluationResultEnum("result").notNull(),
    reason: varchar("reason", { length: 160 }).notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    propertyCreatedIdx: index("rule_evaluations_property_created_idx").on(
      table.propertyId,
      table.createdAt
    ),
    propertyResultIdx: index("rule_evaluations_property_result_idx").on(
      table.propertyId,
      table.result
    ),
    residentCreatedIdx: index("rule_evaluations_resident_created_idx").on(
      table.residentId,
      table.createdAt
    )
  })
);

export const meterValues = pgTable(
  "meter_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id")
      .references(() => chargingSessions.id, { onDelete: "cascade" })
      .notNull(),
    chargerId: uuid("charger_id")
      .references(() => chargers.id, { onDelete: "cascade" })
      .notNull(),
    connectorId: uuid("connector_id").references(() => chargerConnectors.id, {
      onDelete: "set null"
    }),
    sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull(),
    energyWh: integer("energy_wh"),
    powerW: integer("power_w"),
    currentA: numeric("current_a", { precision: 8, scale: 2 }),
    voltageV: numeric("voltage_v", { precision: 8, scale: 2 }),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
    ...timestamps
  },
  (table) => ({
    sessionSampledIdx: index("meter_values_session_sampled_idx").on(table.sessionId, table.sampledAt),
    propertySampledIdx: index("meter_values_property_sampled_idx").on(
      table.propertyId,
      table.sampledAt
    )
  })
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    chargerId: uuid("charger_id").references(() => chargers.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => chargingSessions.id, { onDelete: "set null" }),
    severity: alertSeverityEnum("severity").default("info").notNull(),
    status: alertStatusEnum("status").default("open").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    source: varchar("source", { length: 120 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    propertyStatusIdx: index("alerts_property_status_idx").on(table.propertyId, table.status),
    propertySeverityIdx: index("alerts_property_severity_idx").on(table.propertyId, table.severity)
  })
);

export const tariffs = pgTable(
  "tariffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    ratePerKwh: numeric("rate_per_kwh", { precision: 10, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("MXN").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps
  },
  (table) => ({
    propertyActiveIdx: index("tariffs_property_active_idx").on(table.propertyId, table.isActive)
  })
);

export const billingRecords = pgTable(
  "billing_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id").references(() => residents.id, { onDelete: "set null" }),
    apartmentId: uuid("apartment_id").references(() => apartments.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => chargingSessions.id, { onDelete: "set null" }),
    tariffId: uuid("tariff_id").references(() => tariffs.id, { onDelete: "set null" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    energyKwh: numeric("energy_kwh", { precision: 12, scale: 3 }).notNull(),
    ratePerKwh: numeric("rate_per_kwh", { precision: 10, scale: 4 }).notNull(),
    subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 }).notNull(),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("MXN").notNull(),
    status: billingStatusEnum("status").default("draft").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    propertyPeriodIdx: index("billing_records_property_period_idx").on(
      table.propertyId,
      table.periodStart,
      table.periodEnd
    ),
    residentPeriodIdx: index("billing_records_resident_period_idx").on(
      table.residentId,
      table.periodStart
    )
  })
);

export const sessionAudits = pgTable(
  "session_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id")
      .references(() => chargingSessions.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id").references(() => residents.id, { onDelete: "set null" }),
    apartmentId: uuid("apartment_id").references(() => apartments.id, { onDelete: "set null" }),
    outletId: uuid("outlet_id").references(() => chargers.id, { onDelete: "set null" }),
    auditStatus: sessionAuditStatusEnum("audit_status").default("needs_review").notNull(),
    energyStatus: energyAuditStatusEnum("energy_status").default("normal").notNull(),
    commandStatus: commandAuditStatusEnum("command_status").default("normal").notNull(),
    ruleStatus: ruleAuditStatusEnum("rule_status").default("normal").notNull(),
    billingStatus: auditBillingStatusEnum("billing_status").default("pending_review").notNull(),
    reviewedBy: varchar("reviewed_by", { length: 120 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    notes: text("notes"),
    details: jsonb("details").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps
  },
  (table) => ({
    sessionIdx: uniqueIndex("session_audits_session_idx").on(table.sessionId),
    propertyStatusIdx: index("session_audits_property_status_idx").on(
      table.propertyId,
      table.auditStatus
    ),
    propertyBillingIdx: index("session_audits_property_billing_idx").on(
      table.propertyId,
      table.billingStatus
    ),
    residentIdx: index("session_audits_resident_idx").on(table.residentId)
  })
);

export const billingCycles = pgTable(
  "billing_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: billingCycleStatusEnum("status").default("draft").notNull(),
    totalKwh: numeric("total_kwh", { precision: 12, scale: 3 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0").notNull(),
    totalSessions: integer("total_sessions").default(0).notNull(),
    createdBy: varchar("created_by", { length: 120 }),
    approvedBy: varchar("approved_by", { length: 120 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    propertyPeriodIdx: index("billing_cycles_property_period_idx").on(
      table.propertyId,
      table.periodStart,
      table.periodEnd
    ),
    propertyStatusIdx: index("billing_cycles_property_status_idx").on(table.propertyId, table.status)
  })
);

export const billingCycleItems = pgTable(
  "billing_cycle_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingCycleId: uuid("billing_cycle_id")
      .references(() => billingCycles.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id").references(() => residents.id, { onDelete: "set null" }),
    apartmentId: uuid("apartment_id")
      .references(() => apartments.id, { onDelete: "cascade" })
      .notNull(),
    totalKwh: numeric("total_kwh", { precision: 12, scale: 3 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0").notNull(),
    totalSessions: integer("total_sessions").default(0).notNull(),
    validSessions: integer("valid_sessions").default(0).notNull(),
    warningSessions: integer("warning_sessions").default(0).notNull(),
    excludedSessions: integer("excluded_sessions").default(0).notNull(),
    status: billingCycleItemStatusEnum("status").default("draft").notNull(),
    adjustmentAmount: numeric("adjustment_amount", { precision: 12, scale: 2 }),
    adjustmentReason: varchar("adjustment_reason", { length: 180 }),
    notes: text("notes"),
    ...timestamps
  },
  (table) => ({
    cycleApartmentIdx: uniqueIndex("billing_cycle_items_cycle_apartment_idx").on(
      table.billingCycleId,
      table.apartmentId,
      table.residentId
    ),
    propertyCycleIdx: index("billing_cycle_items_property_cycle_idx").on(
      table.propertyId,
      table.billingCycleId
    )
  })
);

export const billingCycleSessionItems = pgTable(
  "billing_cycle_session_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingCycleId: uuid("billing_cycle_id")
      .references(() => billingCycles.id, { onDelete: "cascade" })
      .notNull(),
    billingCycleItemId: uuid("billing_cycle_item_id")
      .references(() => billingCycleItems.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id")
      .references(() => chargingSessions.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    residentId: uuid("resident_id").references(() => residents.id, { onDelete: "set null" }),
    apartmentId: uuid("apartment_id").references(() => apartments.id, { onDelete: "set null" }),
    energyDeliveredKwh: numeric("energy_delivered_kwh", { precision: 12, scale: 3 })
      .default("0")
      .notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).default("0").notNull(),
    auditStatus: sessionAuditStatusEnum("audit_status").notNull(),
    billingStatus: auditBillingStatusEnum("billing_status").notNull(),
    included: boolean("included").default(true).notNull(),
    exclusionReason: varchar("exclusion_reason", { length: 180 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    cycleSessionIdx: uniqueIndex("billing_cycle_session_items_cycle_session_idx").on(
      table.billingCycleId,
      table.sessionId
    ),
    cycleItemIdx: index("billing_cycle_session_items_cycle_item_idx").on(table.billingCycleItemId)
  })
);

export const exportJobs = pgTable(
  "export_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    billingCycleId: uuid("billing_cycle_id").references(() => billingCycles.id, {
      onDelete: "set null"
    }),
    type: exportJobTypeEnum("type").notNull(),
    status: exportJobStatusEnum("status").default("pending").notNull(),
    fileName: varchar("file_name", { length: 220 }),
    filePath: text("file_path"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => ({
    propertyCreatedIdx: index("export_jobs_property_created_idx").on(
      table.propertyId,
      table.createdAt
    ),
    cycleIdx: index("export_jobs_cycle_idx").on(table.billingCycleId)
  })
);

export const ocppMessages = pgTable(
  "ocpp_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    chargerId: uuid("charger_id").references(() => chargers.id, { onDelete: "set null" }),
    direction: ocppDirectionEnum("direction").notNull(),
    messageTypeId: integer("message_type_id").notNull(),
    uniqueId: varchar("unique_id", { length: 120 }),
    action: varchar("action", { length: 120 }),
    payload: jsonb("payload").$type<Record<string, unknown> | unknown[] | null>(),
    rawMessage: jsonb("raw_message").$type<unknown>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps
  },
  (table) => ({
    chargerReceivedIdx: index("ocpp_messages_charger_received_idx").on(
      table.chargerId,
      table.receivedAt
    ),
    actionIdx: index("ocpp_messages_action_idx").on(table.action),
    rawSearchIdx: index("ocpp_messages_raw_search_idx").using("gin", table.rawMessage)
  })
);

export const systemEvents = pgTable(
  "system_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    chargerId: uuid("charger_id").references(() => chargers.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => chargingSessions.id, { onDelete: "set null" }),
    severity: systemEventSeverityEnum("severity").default("info").notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps
  },
  (table) => ({
    propertyOccurredIdx: index("system_events_property_occurred_idx").on(
      table.propertyId,
      table.occurredAt
    ),
    eventTypeIdx: index("system_events_event_type_idx").on(table.eventType)
  })
);

export const propertiesRelations = relations(properties, ({ many }) => ({
  apartments: many(apartments),
  residents: many(residents),
  userMemberships: many(userPropertyMemberships),
  userAuditEvents: many(userAuditEvents),
  chargers: many(chargers),
  tariffs: many(tariffs),
  deviceCommands: many(deviceCommands),
  accessDevices: many(accessDevices),
  credentialEnrollments: many(credentialEnrollmentSessions),
  credentialEvents: many(credentialEvents),
  authorizationAttempts: many(authorizationAttempts),
  propertyAccessRules: many(propertyAccessRules),
  accessScheduleWindows: many(accessScheduleWindows),
  outletAccessOverrides: many(outletAccessOverrides),
  residentAccessOverrides: many(residentAccessOverrides),
  apartmentAccessOverrides: many(apartmentAccessOverrides),
  ruleEvaluations: many(ruleEvaluations),
  sessionAudits: many(sessionAudits),
  billingCycles: many(billingCycles),
  billingCycleItems: many(billingCycleItems),
  billingCycleSessionItems: many(billingCycleSessionItems),
  exportJobs: many(exportJobs)
}));

export const apartmentsRelations = relations(apartments, ({ one, many }) => ({
  property: one(properties, {
    fields: [apartments.propertyId],
    references: [properties.id]
  }),
  residents: many(residents),
  sessions: many(chargingSessions),
  billingRecords: many(billingRecords),
  accessOverride: many(apartmentAccessOverrides),
  ruleEvaluations: many(ruleEvaluations),
  sessionAudits: many(sessionAudits),
  billingCycleItems: many(billingCycleItems),
  billingCycleSessionItems: many(billingCycleSessionItems),
  userMemberships: many(userPropertyMemberships)
}));

export const residentsRelations = relations(residents, ({ one, many }) => ({
  property: one(properties, {
    fields: [residents.propertyId],
    references: [properties.id]
  }),
  apartment: one(apartments, {
    fields: [residents.apartmentId],
    references: [apartments.id]
  }),
  credentials: many(residentCredentials),
  credentialEnrollments: many(credentialEnrollmentSessions),
  credentialEvents: many(credentialEvents),
  authorizationAttempts: many(authorizationAttempts),
  accessOverride: many(residentAccessOverrides),
  ruleEvaluations: many(ruleEvaluations),
  sessions: many(chargingSessions),
  billingRecords: many(billingRecords),
  sessionAudits: many(sessionAudits),
  billingCycleItems: many(billingCycleItems),
  billingCycleSessionItems: many(billingCycleSessionItems),
  userMemberships: many(userPropertyMemberships)
}));

export const residentCredentialsRelations = relations(residentCredentials, ({ one, many }) => ({
  property: one(properties, {
    fields: [residentCredentials.propertyId],
    references: [properties.id]
  }),
  resident: one(residents, {
    fields: [residentCredentials.residentId],
    references: [residents.id]
  }),
  replacedByCredential: one(residentCredentials, {
    fields: [residentCredentials.replacedByCredentialId],
    references: [residentCredentials.id],
    relationName: "credentialReplacement"
  }),
  replacingCredentials: many(residentCredentials, {
    relationName: "credentialReplacement"
  }),
  events: many(credentialEvents),
  authorizationAttempts: many(authorizationAttempts)
}));

export const appUsersRelations = relations(appUsers, ({ many }) => ({
  memberships: many(userPropertyMemberships),
  sessions: many(userSessions),
  auditEvents: many(userAuditEvents, { relationName: "actorUserAuditEvents" }),
  targetedAuditEvents: many(userAuditEvents, { relationName: "targetUserAuditEvents" }),
  passwordResetTokens: many(passwordResetTokens)
}));

export const userPropertyMembershipsRelations = relations(userPropertyMemberships, ({ one }) => ({
  user: one(appUsers, {
    fields: [userPropertyMemberships.userId],
    references: [appUsers.id]
  }),
  property: one(properties, {
    fields: [userPropertyMemberships.propertyId],
    references: [properties.id]
  }),
  resident: one(residents, {
    fields: [userPropertyMemberships.residentId],
    references: [residents.id]
  }),
  apartment: one(apartments, {
    fields: [userPropertyMemberships.apartmentId],
    references: [apartments.id]
  })
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(appUsers, {
    fields: [userSessions.userId],
    references: [appUsers.id]
  })
}));

export const userAuditEventsRelations = relations(userAuditEvents, ({ one }) => ({
  property: one(properties, {
    fields: [userAuditEvents.propertyId],
    references: [properties.id]
  }),
  user: one(appUsers, {
    fields: [userAuditEvents.userId],
    references: [appUsers.id],
    relationName: "actorUserAuditEvents"
  }),
  targetUser: one(appUsers, {
    fields: [userAuditEvents.targetUserId],
    references: [appUsers.id],
    relationName: "targetUserAuditEvents"
  })
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(appUsers, {
    fields: [passwordResetTokens.userId],
    references: [appUsers.id]
  })
}));

export const chargersRelations = relations(chargers, ({ one, many }) => ({
  property: one(properties, {
    fields: [chargers.propertyId],
    references: [properties.id]
  }),
  connectors: many(chargerConnectors),
  sessions: many(chargingSessions),
  alerts: many(alerts),
  ocppMessages: many(ocppMessages),
  deviceCommands: many(deviceCommands),
  accessDevices: many(accessDevices),
  credentialEnrollments: many(credentialEnrollmentSessions),
  authorizationAttempts: many(authorizationAttempts),
  outletAccessOverrides: many(outletAccessOverrides),
  ruleEvaluations: many(ruleEvaluations),
  sessionAudits: many(sessionAudits)
}));

export const chargerConnectorsRelations = relations(chargerConnectors, ({ one, many }) => ({
  property: one(properties, {
    fields: [chargerConnectors.propertyId],
    references: [properties.id]
  }),
  charger: one(chargers, {
    fields: [chargerConnectors.chargerId],
    references: [chargers.id]
  }),
  sessions: many(chargingSessions),
  meterValues: many(meterValues)
}));

export const chargingSessionsRelations = relations(chargingSessions, ({ one, many }) => ({
  property: one(properties, {
    fields: [chargingSessions.propertyId],
    references: [properties.id]
  }),
  charger: one(chargers, {
    fields: [chargingSessions.chargerId],
    references: [chargers.id]
  }),
  connector: one(chargerConnectors, {
    fields: [chargingSessions.connectorId],
    references: [chargerConnectors.id]
  }),
  resident: one(residents, {
    fields: [chargingSessions.residentId],
    references: [residents.id]
  }),
  apartment: one(apartments, {
    fields: [chargingSessions.apartmentId],
    references: [apartments.id]
  }),
  meterValues: many(meterValues),
  alerts: many(alerts),
  billingRecords: many(billingRecords),
  deviceCommands: many(deviceCommands),
  ruleEvaluations: many(ruleEvaluations),
  audit: many(sessionAudits),
  billingCycleSessionItems: many(billingCycleSessionItems)
}));

export const meterValuesRelations = relations(meterValues, ({ one }) => ({
  property: one(properties, {
    fields: [meterValues.propertyId],
    references: [properties.id]
  }),
  session: one(chargingSessions, {
    fields: [meterValues.sessionId],
    references: [chargingSessions.id]
  }),
  charger: one(chargers, {
    fields: [meterValues.chargerId],
    references: [chargers.id]
  }),
  connector: one(chargerConnectors, {
    fields: [meterValues.connectorId],
    references: [chargerConnectors.id]
  })
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  property: one(properties, {
    fields: [alerts.propertyId],
    references: [properties.id]
  }),
  charger: one(chargers, {
    fields: [alerts.chargerId],
    references: [chargers.id]
  }),
  session: one(chargingSessions, {
    fields: [alerts.sessionId],
    references: [chargingSessions.id]
  })
}));

export const tariffsRelations = relations(tariffs, ({ one, many }) => ({
  property: one(properties, {
    fields: [tariffs.propertyId],
    references: [properties.id]
  }),
  billingRecords: many(billingRecords)
}));

export const billingRecordsRelations = relations(billingRecords, ({ one }) => ({
  property: one(properties, {
    fields: [billingRecords.propertyId],
    references: [properties.id]
  }),
  resident: one(residents, {
    fields: [billingRecords.residentId],
    references: [residents.id]
  }),
  apartment: one(apartments, {
    fields: [billingRecords.apartmentId],
    references: [apartments.id]
  }),
  session: one(chargingSessions, {
    fields: [billingRecords.sessionId],
    references: [chargingSessions.id]
  }),
  tariff: one(tariffs, {
    fields: [billingRecords.tariffId],
    references: [tariffs.id]
  })
}));

export const sessionAuditsRelations = relations(sessionAudits, ({ one }) => ({
  property: one(properties, {
    fields: [sessionAudits.propertyId],
    references: [properties.id]
  }),
  session: one(chargingSessions, {
    fields: [sessionAudits.sessionId],
    references: [chargingSessions.id]
  }),
  resident: one(residents, {
    fields: [sessionAudits.residentId],
    references: [residents.id]
  }),
  apartment: one(apartments, {
    fields: [sessionAudits.apartmentId],
    references: [apartments.id]
  }),
  outlet: one(chargers, {
    fields: [sessionAudits.outletId],
    references: [chargers.id]
  })
}));

export const billingCyclesRelations = relations(billingCycles, ({ one, many }) => ({
  property: one(properties, {
    fields: [billingCycles.propertyId],
    references: [properties.id]
  }),
  items: many(billingCycleItems),
  sessionItems: many(billingCycleSessionItems),
  exportJobs: many(exportJobs)
}));

export const billingCycleItemsRelations = relations(billingCycleItems, ({ one, many }) => ({
  cycle: one(billingCycles, {
    fields: [billingCycleItems.billingCycleId],
    references: [billingCycles.id]
  }),
  property: one(properties, {
    fields: [billingCycleItems.propertyId],
    references: [properties.id]
  }),
  resident: one(residents, {
    fields: [billingCycleItems.residentId],
    references: [residents.id]
  }),
  apartment: one(apartments, {
    fields: [billingCycleItems.apartmentId],
    references: [apartments.id]
  }),
  sessions: many(billingCycleSessionItems)
}));

export const billingCycleSessionItemsRelations = relations(
  billingCycleSessionItems,
  ({ one }) => ({
    cycle: one(billingCycles, {
      fields: [billingCycleSessionItems.billingCycleId],
      references: [billingCycles.id]
    }),
    item: one(billingCycleItems, {
      fields: [billingCycleSessionItems.billingCycleItemId],
      references: [billingCycleItems.id]
    }),
    session: one(chargingSessions, {
      fields: [billingCycleSessionItems.sessionId],
      references: [chargingSessions.id]
    }),
    property: one(properties, {
      fields: [billingCycleSessionItems.propertyId],
      references: [properties.id]
    }),
    resident: one(residents, {
      fields: [billingCycleSessionItems.residentId],
      references: [residents.id]
    }),
    apartment: one(apartments, {
      fields: [billingCycleSessionItems.apartmentId],
      references: [apartments.id]
    })
  })
);

export const exportJobsRelations = relations(exportJobs, ({ one }) => ({
  property: one(properties, {
    fields: [exportJobs.propertyId],
    references: [properties.id]
  }),
  billingCycle: one(billingCycles, {
    fields: [exportJobs.billingCycleId],
    references: [billingCycles.id]
  })
}));

export const ocppMessagesRelations = relations(ocppMessages, ({ one }) => ({
  property: one(properties, {
    fields: [ocppMessages.propertyId],
    references: [properties.id]
  }),
  charger: one(chargers, {
    fields: [ocppMessages.chargerId],
    references: [chargers.id]
  })
}));

export const systemEventsRelations = relations(systemEvents, ({ one }) => ({
  property: one(properties, {
    fields: [systemEvents.propertyId],
    references: [properties.id]
  }),
  charger: one(chargers, {
    fields: [systemEvents.chargerId],
    references: [chargers.id]
  }),
  session: one(chargingSessions, {
    fields: [systemEvents.sessionId],
    references: [chargingSessions.id]
  })
}));

export const deviceCommandsRelations = relations(deviceCommands, ({ one }) => ({
  property: one(properties, {
    fields: [deviceCommands.propertyId],
    references: [properties.id]
  }),
  charger: one(chargers, {
    fields: [deviceCommands.chargerId],
    references: [chargers.id]
  }),
  session: one(chargingSessions, {
    fields: [deviceCommands.sessionId],
    references: [chargingSessions.id]
  })
}));

export const accessDevicesRelations = relations(accessDevices, ({ one, many }) => ({
  property: one(properties, {
    fields: [accessDevices.propertyId],
    references: [properties.id]
  }),
  linkedOutlet: one(chargers, {
    fields: [accessDevices.linkedOutletId],
    references: [chargers.id]
  }),
  credentialEnrollments: many(credentialEnrollmentSessions),
  authorizationAttempts: many(authorizationAttempts)
}));

export const credentialEnrollmentSessionsRelations = relations(
  credentialEnrollmentSessions,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [credentialEnrollmentSessions.propertyId],
      references: [properties.id]
    }),
    resident: one(residents, {
      fields: [credentialEnrollmentSessions.residentId],
      references: [residents.id]
    }),
    oldCredential: one(residentCredentials, {
      fields: [credentialEnrollmentSessions.oldCredentialId],
      references: [residentCredentials.id]
    }),
    accessDevice: one(accessDevices, {
      fields: [credentialEnrollmentSessions.accessDeviceId],
      references: [accessDevices.id]
    }),
    outlet: one(chargers, {
      fields: [credentialEnrollmentSessions.outletId],
      references: [chargers.id]
    }),
    events: many(credentialEvents)
  })
);

export const credentialEventsRelations = relations(credentialEvents, ({ one }) => ({
  property: one(properties, {
    fields: [credentialEvents.propertyId],
    references: [properties.id]
  }),
  resident: one(residents, {
    fields: [credentialEvents.residentId],
    references: [residents.id]
  }),
  credential: one(residentCredentials, {
    fields: [credentialEvents.credentialId],
    references: [residentCredentials.id]
  }),
  enrollment: one(credentialEnrollmentSessions, {
    fields: [credentialEvents.enrollmentId],
    references: [credentialEnrollmentSessions.id]
  })
}));

export const authorizationAttemptsRelations = relations(authorizationAttempts, ({ one }) => ({
  property: one(properties, {
    fields: [authorizationAttempts.propertyId],
    references: [properties.id]
  }),
  resident: one(residents, {
    fields: [authorizationAttempts.residentId],
    references: [residents.id]
  }),
  credential: one(residentCredentials, {
    fields: [authorizationAttempts.credentialId],
    references: [residentCredentials.id]
  }),
  accessDevice: one(accessDevices, {
    fields: [authorizationAttempts.accessDeviceId],
    references: [accessDevices.id]
  }),
  charger: one(chargers, {
    fields: [authorizationAttempts.chargerId],
    references: [chargers.id]
  })
}));

export const propertyAccessRulesRelations = relations(propertyAccessRules, ({ one, many }) => ({
  property: one(properties, {
    fields: [propertyAccessRules.propertyId],
    references: [properties.id]
  }),
  scheduleWindows: many(accessScheduleWindows)
}));

export const accessScheduleWindowsRelations = relations(accessScheduleWindows, ({ one }) => ({
  property: one(properties, {
    fields: [accessScheduleWindows.propertyId],
    references: [properties.id]
  }),
  rule: one(propertyAccessRules, {
    fields: [accessScheduleWindows.ruleId],
    references: [propertyAccessRules.id]
  })
}));

export const outletAccessOverridesRelations = relations(outletAccessOverrides, ({ one }) => ({
  property: one(properties, {
    fields: [outletAccessOverrides.propertyId],
    references: [properties.id]
  }),
  outlet: one(chargers, {
    fields: [outletAccessOverrides.outletId],
    references: [chargers.id]
  })
}));

export const residentAccessOverridesRelations = relations(residentAccessOverrides, ({ one }) => ({
  property: one(properties, {
    fields: [residentAccessOverrides.propertyId],
    references: [properties.id]
  }),
  resident: one(residents, {
    fields: [residentAccessOverrides.residentId],
    references: [residents.id]
  })
}));

export const apartmentAccessOverridesRelations = relations(apartmentAccessOverrides, ({ one }) => ({
  property: one(properties, {
    fields: [apartmentAccessOverrides.propertyId],
    references: [properties.id]
  }),
  apartment: one(apartments, {
    fields: [apartmentAccessOverrides.apartmentId],
    references: [apartments.id]
  })
}));

export const ruleEvaluationsRelations = relations(ruleEvaluations, ({ one }) => ({
  property: one(properties, {
    fields: [ruleEvaluations.propertyId],
    references: [properties.id]
  }),
  resident: one(residents, {
    fields: [ruleEvaluations.residentId],
    references: [residents.id]
  }),
  apartment: one(apartments, {
    fields: [ruleEvaluations.apartmentId],
    references: [apartments.id]
  }),
  outlet: one(chargers, {
    fields: [ruleEvaluations.outletId],
    references: [chargers.id]
  }),
  session: one(chargingSessions, {
    fields: [ruleEvaluations.sessionId],
    references: [chargingSessions.id]
  })
}));

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type ChargingSession = typeof chargingSessions.$inferSelect;
export type NewChargingSession = typeof chargingSessions.$inferInsert;
export type SessionAudit = typeof sessionAudits.$inferSelect;
export type NewSessionAudit = typeof sessionAudits.$inferInsert;
export type BillingCycle = typeof billingCycles.$inferSelect;
export type NewBillingCycle = typeof billingCycles.$inferInsert;
export type BillingCycleItem = typeof billingCycleItems.$inferSelect;
export type NewBillingCycleItem = typeof billingCycleItems.$inferInsert;
export type BillingCycleSessionItem = typeof billingCycleSessionItems.$inferSelect;
export type NewBillingCycleSessionItem = typeof billingCycleSessionItems.$inferInsert;
export type ExportJob = typeof exportJobs.$inferSelect;
export type NewExportJob = typeof exportJobs.$inferInsert;
export type OcppMessageRecord = typeof ocppMessages.$inferSelect;
export type NewOcppMessageRecord = typeof ocppMessages.$inferInsert;
export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type NewDeviceCommand = typeof deviceCommands.$inferInsert;
export type ResidentCredential = typeof residentCredentials.$inferSelect;
export type NewResidentCredential = typeof residentCredentials.$inferInsert;
export type AccessDevice = typeof accessDevices.$inferSelect;
export type NewAccessDevice = typeof accessDevices.$inferInsert;
export type CredentialEnrollmentSession = typeof credentialEnrollmentSessions.$inferSelect;
export type NewCredentialEnrollmentSession = typeof credentialEnrollmentSessions.$inferInsert;
export type CredentialEvent = typeof credentialEvents.$inferSelect;
export type NewCredentialEvent = typeof credentialEvents.$inferInsert;
export type AuthorizationAttempt = typeof authorizationAttempts.$inferSelect;
export type NewAuthorizationAttempt = typeof authorizationAttempts.$inferInsert;
export type PropertyAccessRule = typeof propertyAccessRules.$inferSelect;
export type NewPropertyAccessRule = typeof propertyAccessRules.$inferInsert;
export type AccessScheduleWindow = typeof accessScheduleWindows.$inferSelect;
export type NewAccessScheduleWindow = typeof accessScheduleWindows.$inferInsert;
export type OutletAccessOverride = typeof outletAccessOverrides.$inferSelect;
export type NewOutletAccessOverride = typeof outletAccessOverrides.$inferInsert;
export type ResidentAccessOverride = typeof residentAccessOverrides.$inferSelect;
export type NewResidentAccessOverride = typeof residentAccessOverrides.$inferInsert;
export type ApartmentAccessOverride = typeof apartmentAccessOverrides.$inferSelect;
export type NewApartmentAccessOverride = typeof apartmentAccessOverrides.$inferInsert;
export type RuleEvaluation = typeof ruleEvaluations.$inferSelect;
export type NewRuleEvaluation = typeof ruleEvaluations.$inferInsert;

export const healthcheckSql = sql`select 1`;
