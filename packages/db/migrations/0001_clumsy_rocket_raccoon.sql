CREATE TYPE "public"."activation_method" AS ENUM('rfid', 'mobile', 'admin');--> statement-breakpoint
CREATE TYPE "public"."charging_point_kind" AS ENUM('ocpp_charger', 'controlled_outlet');--> statement-breakpoint
CREATE TYPE "public"."control_mode" AS ENUM('simulated', 'mqtt', 'http', 'modbus', 'lorawan');--> statement-breakpoint
CREATE TYPE "public"."device_command_status" AS ENUM('pending', 'sent', 'acknowledged', 'failed', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."device_command_type" AS ENUM('enable', 'disable', 'read_status');--> statement-breakpoint
ALTER TYPE "public"."session_status" ADD VALUE 'pending_start' BEFORE 'active';--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"charger_id" uuid,
	"session_id" uuid,
	"command_type" "device_command_type" NOT NULL,
	"status" "device_command_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_by" varchar(120),
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chargers" ADD COLUMN "kind" charging_point_kind DEFAULT 'ocpp_charger' NOT NULL;--> statement-breakpoint
ALTER TABLE "chargers" ADD COLUMN "voltage" integer;--> statement-breakpoint
ALTER TABLE "chargers" ADD COLUMN "max_current_amp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "chargers" ADD COLUMN "public_access_code" varchar(120);--> statement-breakpoint
ALTER TABLE "chargers" ADD COLUMN "control_mode" "control_mode" DEFAULT 'simulated' NOT NULL;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD COLUMN "activation_method" "activation_method";--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_commands_property_status_idx" ON "device_commands" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "device_commands_charger_created_idx" ON "device_commands" USING btree ("charger_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chargers_public_access_code_idx" ON "chargers" USING btree ("public_access_code");