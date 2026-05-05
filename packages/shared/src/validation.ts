import { z } from "zod";

export const propertyIdSchema = z.string().min(1);

export const chargerCodeSchema = z.string().min(3).max(64);

export const publicAccessCodeSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9-]+$/i);

export const recordIdSchema = z.string().uuid();

export const rfidTagSchema = z
  .string()
  .trim()
  .min(4)
  .max(80)
  .regex(/^[A-Za-z0-9:_\-\s]+$/);

export const rfidReaderEventSchema = z.object({
  readerCode: z.string().trim().min(3).max(120),
  outletPublicCode: publicAccessCodeSchema.optional(),
  outletId: recordIdSchema.optional(),
  idTag: rfidTagSchema
});

export const credentialLabelSchema = z.string().trim().min(1).max(120);

export const credentialDisableReasonSchema = z.string().trim().min(2).max(160);

export const accessOverrideStatusSchema = z.enum(["allowed", "blocked", "suspended", "limited"]);

export const outletAccessStatusSchema = z.enum([
  "available",
  "maintenance",
  "disabled",
  "reserved"
]);

export const overcurrentActionSchema = z.enum(["alert_only", "stop_session"]);

const optionalNumberFromForm = z.preprocess(
  (value) => {
    if (value === "" || value === null || typeof value === "undefined") {
      return undefined;
    }

    return Number(value);
  },
  z.number().finite().nonnegative().optional()
);

export const propertyAccessRuleUpdateSchema = z.object({
  ruleId: recordIdSchema,
  name: z.string().trim().min(3).max(160),
  active: z.boolean(),
  allowRfid: z.boolean(),
  allowMobile: z.boolean(),
  allowAdmin: z.boolean(),
  maxActiveSessionsPerResident: z.number().int().min(1).max(64),
  maxActiveSessionsPerApartment: z.number().int().min(1).max(64),
  maxActiveSessionsProperty: optionalNumberFromForm,
  maxSessionDurationMinutes: optionalNumberFromForm,
  maxSessionKwh: optionalNumberFromForm,
  maxSessionCost: optionalNumberFromForm,
  startupNoLoadTimeoutSeconds: z.number().int().min(15).max(3600),
  noLoadTimeoutSeconds: z.number().int().min(60).max(86400),
  lowPowerThresholdWatts: z.number().min(1).max(1000),
  overcurrentAction: overcurrentActionSchema,
  defaultMaxCurrentAmp: optionalNumberFromForm,
  scheduleStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  scheduleEndTime: z.string().regex(/^\d{2}:\d{2}$/)
});

export const outletAccessOverrideUpdateSchema = z.object({
  outletId: recordIdSchema,
  status: outletAccessStatusSchema,
  allowRfid: z.boolean().optional(),
  allowMobile: z.boolean().optional(),
  maxCurrentAmp: optionalNumberFromForm,
  maxSessionDurationMinutes: optionalNumberFromForm,
  notes: z.string().trim().max(500).optional()
});

export const residentAccessOverrideUpdateSchema = z.object({
  residentId: recordIdSchema,
  status: accessOverrideStatusSchema,
  allowRfid: z.boolean().optional(),
  allowMobile: z.boolean().optional(),
  maxSessionDurationMinutes: optionalNumberFromForm,
  maxSessionKwh: optionalNumberFromForm,
  maxSessionsPerDay: optionalNumberFromForm,
  notes: z.string().trim().max(500).optional()
});

export const sessionTelemetrySchema = z.object({
  propertyId: propertyIdSchema,
  chargerId: z.string().min(1),
  connectorId: z.number().int().positive(),
  deliveredKwh: z.number().nonnegative(),
  durationMinutes: z.number().int().nonnegative(),
  powerKw: z.number().nonnegative(),
  costAmount: z.number().nonnegative()
});

export const residentAccessSchema = z.object({
  propertyId: propertyIdSchema,
  residentId: z.string().min(1),
  apartmentId: z.string().min(1),
  enabled: z.boolean()
});

export type SessionTelemetryInput = z.infer<typeof sessionTelemetrySchema>;

export type ResidentAccessInput = z.infer<typeof residentAccessSchema>;

export type RfidReaderEventInput = z.infer<typeof rfidReaderEventSchema>;

export type PropertyAccessRuleUpdateInput = z.infer<typeof propertyAccessRuleUpdateSchema>;

export type OutletAccessOverrideUpdateInput = z.infer<typeof outletAccessOverrideUpdateSchema>;

export type ResidentAccessOverrideUpdateInput = z.infer<typeof residentAccessOverrideUpdateSchema>;
