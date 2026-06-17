CREATE TYPE "public"."gateway_kind" AS ENUM('simulator', 'local_gateway', 'milesight', 'plc', 'modbus', 'mqtt', 'http');--> statement-breakpoint
CREATE TYPE "public"."gateway_status" AS ENUM('provisioned', 'online', 'offline', 'disabled', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."organization_plan" AS ENUM('demo', 'standard', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'trial', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('none', 'platform_owner', 'platform_admin', 'platform_support');--> statement-breakpoint
CREATE TABLE "gateway_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(120) NOT NULL,
	"name" varchar(180) NOT NULL,
	"kind" "gateway_kind" DEFAULT 'simulator' NOT NULL,
	"status" "gateway_status" DEFAULT 'provisioned' NOT NULL,
	"auth_token_hash" text,
	"token_last_rotated_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"last_ip" varchar(80),
	"version" varchar(80),
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"legal_name" varchar(220),
	"tax_id" varchar(80),
	"contact_name" varchar(180),
	"contact_email" varchar(180),
	"contact_phone" varchar(60),
	"status" "organization_status" DEFAULT 'trial' NOT NULL,
	"plan" "organization_plan" DEFAULT 'demo' NOT NULL,
	"timezone" varchar(80) DEFAULT 'America/Cancun' NOT NULL,
	"currency" varchar(3) DEFAULT 'MXN' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "platform_role" "platform_role" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "chargers" ADD COLUMN "gateway_id" uuid;--> statement-breakpoint
ALTER TABLE "device_commands" ADD COLUMN "gateway_id" uuid;--> statement-breakpoint
ALTER TABLE "device_commands" ADD COLUMN "locked_by" varchar(160);--> statement-breakpoint
ALTER TABLE "device_commands" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "device_commands" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "device_commands" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "device_commands" ADD COLUMN "idempotency_key" varchar(160);--> statement-breakpoint
ALTER TABLE "device_commands" ADD COLUMN "available_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "gateway_devices" ADD CONSTRAINT "gateway_devices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_devices" ADD CONSTRAINT "gateway_devices_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_devices_code_idx" ON "gateway_devices" USING btree ("code");--> statement-breakpoint
CREATE INDEX "gateway_devices_property_status_idx" ON "gateway_devices" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "gateway_devices_organization_idx" ON "gateway_devices" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
ALTER TABLE "chargers" ADD CONSTRAINT "chargers_gateway_id_gateway_devices_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."gateway_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_gateway_id_gateway_devices_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."gateway_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chargers_gateway_idx" ON "chargers" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "device_commands_gateway_status_idx" ON "device_commands" USING btree ("gateway_id","status","available_at");--> statement-breakpoint
CREATE INDEX "device_commands_lock_idx" ON "device_commands" USING btree ("locked_at","locked_by");--> statement-breakpoint
CREATE UNIQUE INDEX "device_commands_idempotency_idx" ON "device_commands" USING btree ("idempotency_key");