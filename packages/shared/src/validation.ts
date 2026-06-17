import { z } from "zod";
import { appRoles, platformRoles } from "./permissions";

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

export const billingCycleDateSchema = z.coerce.date();

export const billingCycleCreateSchema = z
  .object({
    propertyId: recordIdSchema.optional(),
    periodStart: billingCycleDateSchema,
    periodEnd: billingCycleDateSchema,
    createdBy: z.string().trim().max(120).optional()
  })
  .refine((value) => value.periodEnd > value.periodStart, {
    message: "El fin del periodo debe ser posterior al inicio.",
    path: ["periodEnd"]
  });

export const billingCycleIdSchema = z.object({
  billingCycleId: recordIdSchema
});

export const auditReviewUpdateSchema = z.object({
  sessionId: recordIdSchema,
  notes: z.string().trim().max(1000).optional(),
  reviewedBy: z.string().trim().max(120).optional()
});

export const auditBillingStatusUpdateSchema = z.object({
  sessionId: recordIdSchema,
  reason: z.string().trim().min(2).max(180)
});

export const billingCycleItemAdjustmentSchema = z.object({
  itemId: recordIdSchema,
  adjustmentAmount: z.coerce.number().finite(),
  adjustmentReason: z.string().trim().min(2).max(180)
});

export const reportsPeriodQuerySchema = z
  .object({
    propertyId: recordIdSchema.optional(),
    startDate: billingCycleDateSchema,
    endDate: billingCycleDateSchema
  })
  .refine((value) => value.endDate > value.startDate, {
    message: "El fin del periodo debe ser posterior al inicio.",
    path: ["endDate"]
  });

export const appRoleSchema = z.enum(appRoles);

export const platformRoleSchema = z.enum(platformRoles);

export const appUserStatusSchema = z.enum(["active", "invited", "suspended", "disabled"]);

export const appUserTypeSchema = z.enum(["staff", "resident", "service"]);

export const loginSchema = z.object({
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
  next: z.string().trim().max(500).optional()
});

export const passwordStrengthSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(200)
  .refine((value) => /[a-z]/.test(value), "Incluye una minúscula.")
  .refine((value) => /[A-Z]/.test(value), "Incluye una mayúscula.")
  .refine((value) => /\d/.test(value), "Incluye un número.");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200).optional(),
    newPassword: passwordStrengthSchema,
    confirmPassword: z.string().min(1).max(200)
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"]
  });

export const userCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(180),
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).optional(),
  userType: appUserTypeSchema,
  role: appRoleSchema,
  propertyId: recordIdSchema,
  residentId: recordIdSchema.optional(),
  apartmentId: recordIdSchema.optional(),
  temporaryPassword: passwordStrengthSchema,
  status: appUserStatusSchema.default("active")
});

export const userStatusUpdateSchema = z.object({
  userId: recordIdSchema,
  status: appUserStatusSchema,
  reason: z.string().trim().min(2).max(180).optional()
});

export const userRoleUpdateSchema = z.object({
  membershipId: recordIdSchema,
  role: appRoleSchema
});

export const userTemporaryPasswordSchema = z.object({
  userId: recordIdSchema,
  temporaryPassword: passwordStrengthSchema
});

export const organizationSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const gatewayKindSchema = z.enum(["simulator", "local_gateway"]);

export const gatewayCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[A-Za-z0-9-]+$/)
  .transform((value) => value.toUpperCase());

export const tenantProvisioningSchema = z.object({
  organizationName: z.string().trim().min(2).max(180),
  organizationSlug: organizationSlugSchema,
  contactName: z.string().trim().max(180).optional(),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(180)
    .transform((value) => value.toLowerCase())
    .optional(),
  contactPhone: z.string().trim().max(60).optional(),
  plan: z.enum(["demo", "standard", "pro", "enterprise"]).default("demo"),
  propertyName: z.string().trim().min(2).max(160),
  propertyCode: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((value) => value.toUpperCase()),
  address: z.string().trim().max(500).optional(),
  timezone: z.string().trim().min(3).max(80).default("America/Cancun"),
  currency: z
    .string()
    .trim()
    .length(3)
    .default("MXN")
    .transform((value) => value.toUpperCase()),
  outletCount: z.coerce.number().int().min(1).max(128),
  outletPrefix: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((value) => value.toUpperCase()),
  outletAreaLabel: z.string().trim().min(1).max(160).default("Área de carga"),
  defaultVoltage: z.coerce.number().int().min(100).max(240).default(120),
  defaultMaxCurrentAmp: z.coerce.number().min(1).max(80).default(12),
  tariffName: z.string().trim().min(2).max(160).default("Tarifa residencial"),
  pricePerKwh: z.coerce.number().min(0).max(1000),
  allowRfid: z.boolean().default(true),
  allowMobile: z.boolean().default(true),
  maxActiveSessionsPerResident: z.coerce.number().int().min(1).max(64).default(1),
  maxSessionDurationMinutes: z.coerce.number().int().min(15).max(24 * 60).default(480),
  initialAdminEmail: z
    .string()
    .trim()
    .email()
    .max(180)
    .transform((value) => value.toLowerCase()),
  initialAdminName: z.string().trim().min(2).max(180),
  initialAdminRole: z.enum(["owner", "admin"]).default("owner"),
  createDemoUsers: z.boolean().default(false),
  createGateway: z.boolean().default(true),
  gatewayKind: gatewayKindSchema.default("simulator"),
  gatewayCode: gatewayCodeSchema.optional()
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

export type BillingCycleCreateInput = z.infer<typeof billingCycleCreateSchema>;

export type AuditReviewUpdateInput = z.infer<typeof auditReviewUpdateSchema>;

export type AuditBillingStatusUpdateInput = z.infer<typeof auditBillingStatusUpdateSchema>;

export type BillingCycleItemAdjustmentInput = z.infer<typeof billingCycleItemAdjustmentSchema>;

export type LoginInput = z.infer<typeof loginSchema>;

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export type UserStatusUpdateInput = z.infer<typeof userStatusUpdateSchema>;

export type UserRoleUpdateInput = z.infer<typeof userRoleUpdateSchema>;

export type TenantProvisioningInput = z.infer<typeof tenantProvisioningSchema>;
