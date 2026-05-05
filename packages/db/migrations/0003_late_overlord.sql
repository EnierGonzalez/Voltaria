CREATE TYPE "public"."access_override_status" AS ENUM('allowed', 'blocked', 'suspended', 'limited');--> statement-breakpoint
CREATE TYPE "public"."outlet_access_status" AS ENUM('available', 'maintenance', 'disabled', 'reserved');--> statement-breakpoint
CREATE TYPE "public"."overcurrent_action" AS ENUM('alert_only', 'stop_session');--> statement-breakpoint
CREATE TYPE "public"."rule_evaluation_result" AS ENUM('allowed', 'denied');--> statement-breakpoint
CREATE TABLE "access_schedule_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"rule_id" uuid,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apartment_access_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"status" "access_override_status" DEFAULT 'allowed' NOT NULL,
	"max_active_sessions" integer,
	"max_monthly_kwh" numeric(12, 3),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_access_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"status" "outlet_access_status" DEFAULT 'available' NOT NULL,
	"allow_rfid" boolean,
	"allow_mobile" boolean,
	"max_current_amp" numeric(8, 2),
	"max_session_duration_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_access_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"allow_rfid" boolean DEFAULT true NOT NULL,
	"allow_mobile" boolean DEFAULT true NOT NULL,
	"allow_admin" boolean DEFAULT true NOT NULL,
	"max_active_sessions_per_resident" integer DEFAULT 1 NOT NULL,
	"max_active_sessions_per_apartment" integer DEFAULT 2 NOT NULL,
	"max_active_sessions_property" integer,
	"max_session_duration_minutes" integer,
	"max_session_kwh" numeric(12, 3),
	"max_session_cost" numeric(12, 2),
	"startup_no_load_timeout_seconds" integer DEFAULT 90 NOT NULL,
	"no_load_timeout_seconds" integer DEFAULT 600 NOT NULL,
	"low_power_threshold_watts" numeric(10, 2) DEFAULT '20' NOT NULL,
	"overcurrent_action" "overcurrent_action" DEFAULT 'stop_session' NOT NULL,
	"default_max_current_amp" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resident_access_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"status" "access_override_status" DEFAULT 'allowed' NOT NULL,
	"allow_rfid" boolean,
	"allow_mobile" boolean,
	"max_session_duration_minutes" integer,
	"max_session_kwh" numeric(12, 3),
	"max_sessions_per_day" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"resident_id" uuid,
	"apartment_id" uuid,
	"outlet_id" uuid,
	"session_id" uuid,
	"method" "activation_method" NOT NULL,
	"result" "rule_evaluation_result" NOT NULL,
	"reason" varchar(160) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_schedule_windows" ADD CONSTRAINT "access_schedule_windows_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_schedule_windows" ADD CONSTRAINT "access_schedule_windows_rule_id_property_access_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."property_access_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartment_access_overrides" ADD CONSTRAINT "apartment_access_overrides_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartment_access_overrides" ADD CONSTRAINT "apartment_access_overrides_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_access_overrides" ADD CONSTRAINT "outlet_access_overrides_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_access_overrides" ADD CONSTRAINT "outlet_access_overrides_outlet_id_chargers_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."chargers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_access_rules" ADD CONSTRAINT "property_access_rules_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_access_overrides" ADD CONSTRAINT "resident_access_overrides_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_access_overrides" ADD CONSTRAINT "resident_access_overrides_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_evaluations" ADD CONSTRAINT "rule_evaluations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_evaluations" ADD CONSTRAINT "rule_evaluations_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_evaluations" ADD CONSTRAINT "rule_evaluations_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_evaluations" ADD CONSTRAINT "rule_evaluations_outlet_id_chargers_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."chargers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_evaluations" ADD CONSTRAINT "rule_evaluations_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_schedule_windows_property_day_idx" ON "access_schedule_windows" USING btree ("property_id","day_of_week");--> statement-breakpoint
CREATE INDEX "access_schedule_windows_rule_idx" ON "access_schedule_windows" USING btree ("rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "apartment_access_overrides_property_apartment_idx" ON "apartment_access_overrides" USING btree ("property_id","apartment_id");--> statement-breakpoint
CREATE INDEX "apartment_access_overrides_property_status_idx" ON "apartment_access_overrides" USING btree ("property_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_access_overrides_property_outlet_idx" ON "outlet_access_overrides" USING btree ("property_id","outlet_id");--> statement-breakpoint
CREATE INDEX "outlet_access_overrides_property_status_idx" ON "outlet_access_overrides" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "property_access_rules_property_active_idx" ON "property_access_rules" USING btree ("property_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "resident_access_overrides_property_resident_idx" ON "resident_access_overrides" USING btree ("property_id","resident_id");--> statement-breakpoint
CREATE INDEX "resident_access_overrides_property_status_idx" ON "resident_access_overrides" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "rule_evaluations_property_created_idx" ON "rule_evaluations" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE INDEX "rule_evaluations_property_result_idx" ON "rule_evaluations" USING btree ("property_id","result");--> statement-breakpoint
CREATE INDEX "rule_evaluations_resident_created_idx" ON "rule_evaluations" USING btree ("resident_id","created_at");