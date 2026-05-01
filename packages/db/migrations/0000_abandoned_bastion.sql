CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('draft', 'pending', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."charger_status" AS ENUM('available', 'charging', 'offline', 'faulted', 'reserved');--> statement-breakpoint
CREATE TYPE "public"."connector_status" AS ENUM('available', 'occupied', 'charging', 'faulted', 'unavailable', 'reserved');--> statement-breakpoint
CREATE TYPE "public"."ocpp_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'completed', 'interrupted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."system_event_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"charger_id" uuid,
	"session_id" uuid,
	"severity" "alert_severity" DEFAULT 'info' NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text,
	"source" varchar(120),
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apartments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"tower" varchar(80),
	"number" varchar(40) NOT NULL,
	"floor" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"resident_id" uuid,
	"apartment_id" uuid,
	"session_id" uuid,
	"tariff_id" uuid,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"energy_kwh" numeric(12, 3) NOT NULL,
	"rate_per_kwh" numeric(10, 4) NOT NULL,
	"subtotal_amount" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'MXN' NOT NULL,
	"status" "billing_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charger_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"charger_id" uuid NOT NULL,
	"connector_number" integer NOT NULL,
	"status" "connector_status" DEFAULT 'available' NOT NULL,
	"max_power_kw" numeric(8, 2),
	"last_status_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chargers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"ocpp_identity" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"location" varchar(160),
	"vendor" varchar(120),
	"model" varchar(120),
	"serial_number" varchar(120),
	"firmware_version" varchar(120),
	"status" charger_status DEFAULT 'offline' NOT NULL,
	"max_power_kw" numeric(8, 2),
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charging_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"charger_id" uuid NOT NULL,
	"connector_id" uuid,
	"resident_id" uuid,
	"apartment_id" uuid,
	"ocpp_transaction_id" integer,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"meter_start_wh" integer,
	"meter_stop_wh" integer,
	"energy_kwh" numeric(12, 3) DEFAULT '0' NOT NULL,
	"peak_power_kw" numeric(8, 2),
	"average_power_kw" numeric(8, 2),
	"cost_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'MXN' NOT NULL,
	"stop_reason" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meter_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"charger_id" uuid NOT NULL,
	"connector_id" uuid,
	"sampled_at" timestamp with time zone NOT NULL,
	"energy_wh" integer,
	"power_w" integer,
	"current_a" numeric(8, 2),
	"voltage_v" numeric(8, 2),
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocpp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"charger_id" uuid,
	"direction" "ocpp_direction" NOT NULL,
	"message_type_id" integer NOT NULL,
	"unique_id" varchar(120),
	"action" varchar(120),
	"payload" jsonb,
	"raw_message" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"address" text,
	"timezone" varchar(80) DEFAULT 'America/Cancun' NOT NULL,
	"billing_currency" varchar(3) DEFAULT 'MXN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "resident_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"provider_key" varchar(80) NOT NULL,
	"provider_subject" varchar(220) NOT NULL,
	"credential_type" varchar(80) DEFAULT 'passwordless' NOT NULL,
	"password_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "residents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"apartment_id" uuid,
	"full_name" varchar(180) NOT NULL,
	"email" varchar(180) NOT NULL,
	"phone" varchar(40),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"charger_id" uuid,
	"session_id" uuid,
	"severity" "system_event_severity" DEFAULT 'info' NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"rate_per_kwh" numeric(10, 4) NOT NULL,
	"currency" varchar(3) DEFAULT 'MXN' NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charger_connectors" ADD CONSTRAINT "charger_connectors_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charger_connectors" ADD CONSTRAINT "charger_connectors_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chargers" ADD CONSTRAINT "chargers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_connector_id_charger_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."charger_connectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_values" ADD CONSTRAINT "meter_values_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_values" ADD CONSTRAINT "meter_values_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_values" ADD CONSTRAINT "meter_values_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_values" ADD CONSTRAINT "meter_values_connector_id_charger_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."charger_connectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocpp_messages" ADD CONSTRAINT "ocpp_messages_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocpp_messages" ADD CONSTRAINT "ocpp_messages_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD CONSTRAINT "resident_credentials_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_property_status_idx" ON "alerts" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "alerts_property_severity_idx" ON "alerts" USING btree ("property_id","severity");--> statement-breakpoint
CREATE UNIQUE INDEX "apartments_property_number_idx" ON "apartments" USING btree ("property_id","tower","number");--> statement-breakpoint
CREATE INDEX "billing_records_property_period_idx" ON "billing_records" USING btree ("property_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "billing_records_resident_period_idx" ON "billing_records" USING btree ("resident_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "charger_connectors_unique_idx" ON "charger_connectors" USING btree ("charger_id","connector_number");--> statement-breakpoint
CREATE INDEX "charger_connectors_property_idx" ON "charger_connectors" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chargers_property_identity_idx" ON "chargers" USING btree ("property_id","ocpp_identity");--> statement-breakpoint
CREATE INDEX "chargers_property_status_idx" ON "chargers" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "charging_sessions_property_started_idx" ON "charging_sessions" USING btree ("property_id","started_at");--> statement-breakpoint
CREATE INDEX "charging_sessions_charger_status_idx" ON "charging_sessions" USING btree ("charger_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "charging_sessions_ocpp_transaction_idx" ON "charging_sessions" USING btree ("charger_id","ocpp_transaction_id");--> statement-breakpoint
CREATE INDEX "meter_values_session_sampled_idx" ON "meter_values" USING btree ("session_id","sampled_at");--> statement-breakpoint
CREATE INDEX "meter_values_property_sampled_idx" ON "meter_values" USING btree ("property_id","sampled_at");--> statement-breakpoint
CREATE INDEX "ocpp_messages_charger_received_idx" ON "ocpp_messages" USING btree ("charger_id","received_at");--> statement-breakpoint
CREATE INDEX "ocpp_messages_action_idx" ON "ocpp_messages" USING btree ("action");--> statement-breakpoint
CREATE INDEX "ocpp_messages_raw_search_idx" ON "ocpp_messages" USING gin ("raw_message");--> statement-breakpoint
CREATE UNIQUE INDEX "resident_credentials_provider_subject_idx" ON "resident_credentials" USING btree ("provider_key","provider_subject");--> statement-breakpoint
CREATE INDEX "resident_credentials_resident_idx" ON "resident_credentials" USING btree ("resident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "residents_property_email_idx" ON "residents" USING btree ("property_id","email");--> statement-breakpoint
CREATE INDEX "residents_property_idx" ON "residents" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "system_events_property_occurred_idx" ON "system_events" USING btree ("property_id","occurred_at");--> statement-breakpoint
CREATE INDEX "system_events_event_type_idx" ON "system_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "tariffs_property_active_idx" ON "tariffs" USING btree ("property_id","is_active");
