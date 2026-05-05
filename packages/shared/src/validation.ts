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
