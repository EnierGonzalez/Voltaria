import { relations, sql } from "drizzle-orm";
import {
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
    residentId: uuid("resident_id")
      .references(() => residents.id, { onDelete: "cascade" })
      .notNull(),
    providerKey: varchar("provider_key", { length: 80 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 220 }).notNull(),
    credentialType: varchar("credential_type", { length: 80 }).default("passwordless").notNull(),
    passwordHash: text("password_hash"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    providerSubjectIdx: uniqueIndex("resident_credentials_provider_subject_idx").on(
      table.providerKey,
      table.providerSubject
    ),
    residentIdx: index("resident_credentials_resident_idx").on(table.residentId)
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
  chargers: many(chargers),
  tariffs: many(tariffs),
  deviceCommands: many(deviceCommands)
}));

export const apartmentsRelations = relations(apartments, ({ one, many }) => ({
  property: one(properties, {
    fields: [apartments.propertyId],
    references: [properties.id]
  }),
  residents: many(residents),
  sessions: many(chargingSessions),
  billingRecords: many(billingRecords)
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
  sessions: many(chargingSessions),
  billingRecords: many(billingRecords)
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
  deviceCommands: many(deviceCommands)
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
  deviceCommands: many(deviceCommands)
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

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type ChargingSession = typeof chargingSessions.$inferSelect;
export type NewChargingSession = typeof chargingSessions.$inferInsert;
export type OcppMessageRecord = typeof ocppMessages.$inferSelect;
export type NewOcppMessageRecord = typeof ocppMessages.$inferInsert;
export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type NewDeviceCommand = typeof deviceCommands.$inferInsert;

export const healthcheckSql = sql`select 1`;
