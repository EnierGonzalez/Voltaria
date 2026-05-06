CREATE TYPE "public"."audit_billing_status" AS ENUM('billable', 'not_billable', 'excluded', 'pending_review');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle_item_status" AS ENUM('draft', 'approved', 'excluded', 'adjusted');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle_status" AS ENUM('draft', 'reviewing', 'approved', 'exported', 'closed');--> statement-breakpoint
CREATE TYPE "public"."command_audit_status" AS ENUM('normal', 'missing_enable_ack', 'missing_disable_ack', 'command_timeout');--> statement-breakpoint
CREATE TYPE "public"."energy_audit_status" AS ENUM('normal', 'zero_consumption', 'low_consumption', 'suspicious_spike', 'missing_meter_values', 'meter_mismatch');--> statement-breakpoint
CREATE TYPE "public"."export_job_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."export_job_type" AS ENUM('billing_csv', 'sessions_csv', 'audit_csv');--> statement-breakpoint
CREATE TYPE "public"."rule_audit_status" AS ENUM('normal', 'stopped_by_rule', 'denied_before_start');--> statement-breakpoint
CREATE TYPE "public"."session_audit_status" AS ENUM('valid', 'warning', 'failed', 'needs_review');--> statement-breakpoint
CREATE TABLE "billing_cycle_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_cycle_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"resident_id" uuid,
	"apartment_id" uuid NOT NULL,
	"total_kwh" numeric(12, 3) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"valid_sessions" integer DEFAULT 0 NOT NULL,
	"warning_sessions" integer DEFAULT 0 NOT NULL,
	"excluded_sessions" integer DEFAULT 0 NOT NULL,
	"status" "billing_cycle_item_status" DEFAULT 'draft' NOT NULL,
	"adjustment_amount" numeric(12, 2),
	"adjustment_reason" varchar(180),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_cycle_session_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_cycle_id" uuid NOT NULL,
	"billing_cycle_item_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"resident_id" uuid,
	"apartment_id" uuid,
	"energy_delivered_kwh" numeric(12, 3) DEFAULT '0' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"audit_status" "session_audit_status" NOT NULL,
	"billing_status" "audit_billing_status" NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"exclusion_reason" varchar(180),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "billing_cycle_status" DEFAULT 'draft' NOT NULL,
	"total_kwh" numeric(12, 3) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(120),
	"approved_by" varchar(120),
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"billing_cycle_id" uuid,
	"type" "export_job_type" NOT NULL,
	"status" "export_job_status" DEFAULT 'pending' NOT NULL,
	"file_name" varchar(220),
	"file_path" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"resident_id" uuid,
	"apartment_id" uuid,
	"outlet_id" uuid,
	"audit_status" "session_audit_status" DEFAULT 'needs_review' NOT NULL,
	"energy_status" "energy_audit_status" DEFAULT 'normal' NOT NULL,
	"command_status" "command_audit_status" DEFAULT 'normal' NOT NULL,
	"rule_status" "rule_audit_status" DEFAULT 'normal' NOT NULL,
	"billing_status" "audit_billing_status" DEFAULT 'pending_review' NOT NULL,
	"reviewed_by" varchar(120),
	"reviewed_at" timestamp with time zone,
	"notes" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_cycle_items" ADD CONSTRAINT "billing_cycle_items_billing_cycle_id_billing_cycles_id_fk" FOREIGN KEY ("billing_cycle_id") REFERENCES "public"."billing_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycle_items" ADD CONSTRAINT "billing_cycle_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycle_items" ADD CONSTRAINT "billing_cycle_items_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycle_items" ADD CONSTRAINT "billing_cycle_items_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycle_session_items" ADD CONSTRAINT "billing_cycle_session_items_billing_cycle_id_billing_cycles_id_fk" FOREIGN KEY ("billing_cycle_id") REFERENCES "public"."billing_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycle_session_items" ADD CONSTRAINT "billing_cycle_session_items_billing_cycle_item_id_billing_cycle_items_id_fk" FOREIGN KEY ("billing_cycle_item_id") REFERENCES "public"."billing_cycle_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycle_session_items" ADD CONSTRAINT "billing_cycle_session_items_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycle_session_items" ADD CONSTRAINT "billing_cycle_session_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycle_session_items" ADD CONSTRAINT "billing_cycle_session_items_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycle_session_items" ADD CONSTRAINT "billing_cycle_session_items_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cycles" ADD CONSTRAINT "billing_cycles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_billing_cycle_id_billing_cycles_id_fk" FOREIGN KEY ("billing_cycle_id") REFERENCES "public"."billing_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audits" ADD CONSTRAINT "session_audits_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audits" ADD CONSTRAINT "session_audits_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audits" ADD CONSTRAINT "session_audits_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audits" ADD CONSTRAINT "session_audits_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audits" ADD CONSTRAINT "session_audits_outlet_id_chargers_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."chargers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_cycle_items_cycle_apartment_idx" ON "billing_cycle_items" USING btree ("billing_cycle_id","apartment_id","resident_id");--> statement-breakpoint
CREATE INDEX "billing_cycle_items_property_cycle_idx" ON "billing_cycle_items" USING btree ("property_id","billing_cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_cycle_session_items_cycle_session_idx" ON "billing_cycle_session_items" USING btree ("billing_cycle_id","session_id");--> statement-breakpoint
CREATE INDEX "billing_cycle_session_items_cycle_item_idx" ON "billing_cycle_session_items" USING btree ("billing_cycle_item_id");--> statement-breakpoint
CREATE INDEX "billing_cycles_property_period_idx" ON "billing_cycles" USING btree ("property_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "billing_cycles_property_status_idx" ON "billing_cycles" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "export_jobs_property_created_idx" ON "export_jobs" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE INDEX "export_jobs_cycle_idx" ON "export_jobs" USING btree ("billing_cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_audits_session_idx" ON "session_audits" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_audits_property_status_idx" ON "session_audits" USING btree ("property_id","audit_status");--> statement-breakpoint
CREATE INDEX "session_audits_property_billing_idx" ON "session_audits" USING btree ("property_id","billing_status");--> statement-breakpoint
CREATE INDEX "session_audits_resident_idx" ON "session_audits" USING btree ("resident_id");