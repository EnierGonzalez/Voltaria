CREATE TYPE "public"."access_device_kind" AS ENUM('rfid_reader', 'rfid_kiosk', 'mobile_app', 'admin_panel');--> statement-breakpoint
CREATE TYPE "public"."access_device_status" AS ENUM('online', 'offline', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."authorization_attempt_result" AS ENUM('accepted', 'rejected', 'captured', 'expired', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."credential_enrollment_mode" AS ENUM('assign', 'replace');--> statement-breakpoint
CREATE TYPE "public"."credential_enrollment_status" AS ENUM('waiting', 'captured', 'expired', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('active', 'disabled', 'lost', 'stolen', 'damaged', 'replaced', 'expired', 'pending_enrollment');--> statement-breakpoint
CREATE TABLE "access_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"kind" "access_device_kind" NOT NULL,
	"location_label" varchar(160),
	"linked_outlet_id" uuid,
	"status" "access_device_status" DEFAULT 'offline' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authorization_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"resident_id" uuid,
	"credential_id" uuid,
	"access_device_id" uuid,
	"charger_id" uuid,
	"method" "activation_method" NOT NULL,
	"result" "authorization_attempt_result" NOT NULL,
	"reason" varchar(160),
	"masked_value" varchar(80),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential_enrollment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"old_credential_id" uuid,
	"access_device_id" uuid,
	"outlet_id" uuid,
	"mode" "credential_enrollment_mode" NOT NULL,
	"status" "credential_enrollment_status" DEFAULT 'waiting' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"captured_masked_value" varchar(80),
	"created_by" varchar(120),
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"resident_id" uuid,
	"credential_id" uuid,
	"enrollment_id" uuid,
	"action" varchar(120) NOT NULL,
	"reason" varchar(160),
	"performed_by" varchar(120),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD COLUMN "property_id" uuid;--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD COLUMN "label" varchar(120);--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD COLUMN "hashed_value" text;--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD COLUMN "masked_value" varchar(80);--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD COLUMN "status" "credential_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD COLUMN "replaced_by_credential_id" uuid;--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
UPDATE "resident_credentials" AS rc
SET "property_id" = r."property_id",
    "label" = COALESCE(rc."label", rc."metadata"->>'label'),
    "masked_value" = COALESCE(rc."masked_value", rc."metadata"->>'maskedValue'),
    "status" = CASE
      WHEN rc."metadata"->>'status' IN ('disabled', 'lost', 'stolen', 'damaged', 'replaced', 'expired', 'pending_enrollment')
        THEN (rc."metadata"->>'status')::credential_status
      ELSE rc."status"
    END
FROM "residents" AS r
WHERE rc."resident_id" = r."id";--> statement-breakpoint
ALTER TABLE "resident_credentials" ALTER COLUMN "property_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "access_devices" ADD CONSTRAINT "access_devices_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_devices" ADD CONSTRAINT "access_devices_linked_outlet_id_chargers_id_fk" FOREIGN KEY ("linked_outlet_id") REFERENCES "public"."chargers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorization_attempts" ADD CONSTRAINT "authorization_attempts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorization_attempts" ADD CONSTRAINT "authorization_attempts_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorization_attempts" ADD CONSTRAINT "authorization_attempts_credential_id_resident_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."resident_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorization_attempts" ADD CONSTRAINT "authorization_attempts_access_device_id_access_devices_id_fk" FOREIGN KEY ("access_device_id") REFERENCES "public"."access_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorization_attempts" ADD CONSTRAINT "authorization_attempts_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_enrollment_sessions" ADD CONSTRAINT "credential_enrollment_sessions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_enrollment_sessions" ADD CONSTRAINT "credential_enrollment_sessions_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_enrollment_sessions" ADD CONSTRAINT "credential_enrollment_sessions_old_credential_id_resident_credentials_id_fk" FOREIGN KEY ("old_credential_id") REFERENCES "public"."resident_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_enrollment_sessions" ADD CONSTRAINT "credential_enrollment_sessions_access_device_id_access_devices_id_fk" FOREIGN KEY ("access_device_id") REFERENCES "public"."access_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_enrollment_sessions" ADD CONSTRAINT "credential_enrollment_sessions_outlet_id_chargers_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."chargers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_credential_id_resident_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."resident_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_enrollment_id_credential_enrollment_sessions_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."credential_enrollment_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_devices_property_code_idx" ON "access_devices" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "access_devices_property_status_idx" ON "access_devices" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "authorization_attempts_property_created_idx" ON "authorization_attempts" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE INDEX "authorization_attempts_credential_idx" ON "authorization_attempts" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "credential_enrollments_property_status_expires_idx" ON "credential_enrollment_sessions" USING btree ("property_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "credential_enrollments_resident_idx" ON "credential_enrollment_sessions" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "credential_events_property_created_idx" ON "credential_events" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE INDEX "credential_events_credential_idx" ON "credential_events" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "credential_events_resident_idx" ON "credential_events" USING btree ("resident_id");--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD CONSTRAINT "resident_credentials_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_credentials" ADD CONSTRAINT "resident_credentials_replaced_by_credential_id_resident_credentials_id_fk" FOREIGN KEY ("replaced_by_credential_id") REFERENCES "public"."resident_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resident_credentials_property_resident_idx" ON "resident_credentials" USING btree ("property_id","resident_id");--> statement-breakpoint
CREATE INDEX "resident_credentials_property_type_status_idx" ON "resident_credentials" USING btree ("property_id","credential_type","status");--> statement-breakpoint
CREATE INDEX "resident_credentials_property_hashed_idx" ON "resident_credentials" USING btree ("property_id","hashed_value");--> statement-breakpoint
CREATE UNIQUE INDEX "resident_credentials_active_rfid_hash_idx" ON "resident_credentials" USING btree ("property_id","hashed_value") WHERE "resident_credentials"."credential_type" = 'rfid' and "resident_credentials"."status" = 'active';
