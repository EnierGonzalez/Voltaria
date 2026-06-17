import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AppRole, TenantProvisioningInput } from "@voltaria/shared";
import { tenantProvisioningSchema } from "@voltaria/shared";
import type { VoltariaDb } from "./client";
import { hashPassword, validatePasswordStrength } from "./auth-utils";
import {
  accessDevices,
  accessScheduleWindows,
  appUsers,
  chargerConnectors,
  chargers,
  gatewayDevices,
  organizations,
  properties,
  propertyAccessRules,
  systemEvents,
  tariffs,
  userPropertyMemberships
} from "./schema";
import { createGateway, type GatewayConfig } from "./gateway-service";
import { normalizeEmail } from "./auth-service";

export type TenantProvisioningResult = {
  organizationId: string;
  propertyId: string;
  gatewayId?: string;
  gatewayCode?: string;
  gatewayAuthToken?: string;
  gatewayConfig?: GatewayConfig;
  initialAdminEmail: string;
  tempPassword?: string;
  demoUsers: Array<{ email: string; tempPassword?: string; role: AppRole }>;
  warnings: string[];
};

export async function createTenant(
  db: VoltariaDb,
  input: TenantProvisioningInput
): Promise<TenantProvisioningResult> {
  const parsed = tenantProvisioningSchema.parse(input);

  return db.transaction(async (tx) => {
    const warnings: string[] = [];
    const propertySlug = slugify(parsed.propertyCode);
    const gatewayCode =
      parsed.gatewayCode ?? `GW-${parsed.propertyCode.replace(/[^A-Z0-9]/g, "")}-SIM`;

    await assertUniqueOrganizationSlug(tx, parsed.organizationSlug);
    await assertUniquePropertySlug(tx, propertySlug);

    if (parsed.createGateway) {
      await assertUniqueGatewayCode(tx, gatewayCode);
    }

    const [organization] = await tx
      .insert(organizations)
      .values({
        name: parsed.organizationName,
        slug: parsed.organizationSlug,
        contactName: parsed.contactName || null,
        contactEmail: parsed.contactEmail || null,
        contactPhone: parsed.contactPhone || null,
        status: "trial",
        plan: parsed.plan,
        timezone: parsed.timezone,
        currency: parsed.currency,
        metadata: { provisionedBy: "platform_admin" }
      })
      .returning();

    if (!organization) {
      throw new Error("No se pudo crear la organización.");
    }

    const [property] = await tx
      .insert(properties)
      .values({
        organizationId: organization.id,
        name: parsed.propertyName,
        slug: propertySlug,
        address: parsed.address || null,
        timezone: parsed.timezone,
        billingCurrency: parsed.currency
      })
      .returning();

    if (!property) {
      throw new Error("No se pudo crear la propiedad.");
    }

    const [tariff] = await tx
      .insert(tariffs)
      .values({
        propertyId: property.id,
        name: parsed.tariffName,
        ratePerKwh: parsed.pricePerKwh.toFixed(4),
        currency: parsed.currency,
        validFrom: new Date(),
        isActive: true
      })
      .returning();

    if (!tariff) {
      throw new Error("No se pudo crear la tarifa.");
    }

    const [rule] = await tx
      .insert(propertyAccessRules)
      .values({
        propertyId: property.id,
        name: "Regla residencial estándar",
        active: true,
        allowRfid: parsed.allowRfid,
        allowMobile: parsed.allowMobile,
        allowAdmin: true,
        maxActiveSessionsPerResident: parsed.maxActiveSessionsPerResident,
        maxActiveSessionsPerApartment: 2,
        maxActiveSessionsProperty: parsed.outletCount,
        maxSessionDurationMinutes: parsed.maxSessionDurationMinutes,
        startupNoLoadTimeoutSeconds: 90,
        noLoadTimeoutSeconds: 600,
        lowPowerThresholdWatts: "20.00",
        overcurrentAction: "stop_session",
        defaultMaxCurrentAmp: parsed.defaultMaxCurrentAmp.toFixed(2)
      })
      .returning();

    if (!rule) {
      throw new Error("No se pudo crear la regla operativa.");
    }

    await tx.insert(accessScheduleWindows).values(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        propertyId: property.id,
        ruleId: rule.id,
        dayOfWeek,
        startTime: "00:00",
        endTime: "23:59",
        active: true
      }))
    );

    let gatewayResult:
      | Awaited<ReturnType<typeof createGateway>>
      | undefined;

    if (parsed.createGateway) {
      gatewayResult = await createGateway(tx, {
        organizationId: organization.id,
        propertyId: property.id,
        code: gatewayCode,
        name: `${parsed.propertyName} Gateway`,
        kind: parsed.gatewayKind,
        status: "provisioned",
        config: {
          pollIntervalMs: 3000,
          meterIntervalMs: 10000,
          workerScope: parsed.gatewayKind === "simulator" ? "gateway" : "local_gateway"
        },
        metadata: { provisionedBy: "platform_admin" }
      });
    }

    const outletRows = await tx
      .insert(chargers)
      .values(
        Array.from({ length: parsed.outletCount }, (_, index) => {
          const number = String(index + 1).padStart(2, "0");
          const code = `${parsed.outletPrefix}-${number}`;

          return {
            propertyId: property.id,
            gatewayId: gatewayResult?.gatewayId,
            kind: "controlled_outlet" as const,
            ocppIdentity: code,
            name: `Toma ${number}`,
            location: `${parsed.outletAreaLabel} ${number}`,
            vendor: "Voltaria",
            model: "120V Controlled Outlet",
            serialNumber: `${propertySlug}-${code}`.toUpperCase(),
            firmwareVersion: "simulator-ready",
            status: "available" as const,
            voltage: parsed.defaultVoltage,
            maxCurrentAmp: parsed.defaultMaxCurrentAmp.toFixed(2),
            maxPowerKw: ((parsed.defaultVoltage * parsed.defaultMaxCurrentAmp) / 1000).toFixed(2),
            publicAccessCode: `${propertySlug}-${code}`.toLowerCase(),
            controlMode: parsed.gatewayKind === "simulator" ? ("simulated" as const) : ("http" as const)
          };
        })
      )
      .returning();

    await tx.insert(chargerConnectors).values(
      outletRows.map((outlet) => ({
        propertyId: property.id,
        chargerId: outlet.id,
        connectorNumber: 1,
        status: "available" as const,
        maxPowerKw: outlet.maxPowerKw,
        lastStatusAt: new Date()
      }))
    );

    await tx.insert(accessDevices).values({
      propertyId: property.id,
      code: `RFID-PANEL-${parsed.propertyCode}`,
      name: `Panel RFID ${parsed.propertyName}`,
      kind: "rfid_kiosk",
      locationLabel: parsed.outletAreaLabel,
      linkedOutletId: outletRows[0]?.id,
      status: "online",
      lastSeenAt: new Date(),
      metadata: { provisionedBy: "platform_admin" }
    });

    const adminUser = await ensureTenantUser(tx, {
      email: parsed.initialAdminEmail,
      fullName: parsed.initialAdminName,
      role: parsed.initialAdminRole,
      propertyId: property.id,
      userType: "staff"
    });

    if (!adminUser.tempPassword) {
      warnings.push("El usuario inicial ya existía; no se generó contraseña temporal nueva.");
    }

    const demoUsers = parsed.createDemoUsers
      ? await createDemoTenantUsers(tx, property.id, parsed.organizationSlug)
      : [];

    await tx.insert(systemEvents).values({
      propertyId: property.id,
      severity: "info",
      eventType: "tenant_provisioned",
      message: `Tenant ${organization.name} provisionado desde Platform Admin.`,
      metadata: {
        organizationId: organization.id,
        outletCount: outletRows.length,
        gatewayId: gatewayResult?.gatewayId,
        tariffId: tariff.id
      },
      occurredAt: new Date()
    });

    return {
      organizationId: organization.id,
      propertyId: property.id,
      ...(gatewayResult
        ? {
            gatewayId: gatewayResult.gatewayId,
            gatewayCode: gatewayResult.gatewayCode,
            gatewayAuthToken: gatewayResult.authToken,
            gatewayConfig: gatewayResult.config
          }
        : {}),
      initialAdminEmail: parsed.initialAdminEmail,
      ...(adminUser.tempPassword ? { tempPassword: adminUser.tempPassword } : {}),
      demoUsers,
      warnings
    };
  });
}

async function assertUniqueOrganizationSlug(
  db: Pick<VoltariaDb, "select">,
  slug: string
) {
  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (existing) {
    throw new Error("Ya existe una organización con ese slug.");
  }
}

async function assertUniquePropertySlug(db: Pick<VoltariaDb, "select">, slug: string) {
  const [existing] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);

  if (existing) {
    throw new Error("Ya existe una propiedad con ese código.");
  }
}

async function assertUniqueGatewayCode(db: Pick<VoltariaDb, "select">, code: string) {
  const [existing] = await db
    .select({ id: gatewayDevices.id })
    .from(gatewayDevices)
    .where(eq(gatewayDevices.code, code))
    .limit(1);

  if (existing) {
    throw new Error("Ya existe un gateway con ese código.");
  }
}

async function ensureTenantUser(
  db: Pick<VoltariaDb, "insert" | "select" | "update">,
  input: {
    email: string;
    fullName: string;
    role: AppRole;
    propertyId: string;
    userType: "staff" | "resident" | "service";
  }
): Promise<{ userId: string; email: string; role: AppRole; tempPassword?: string }> {
  const email = normalizeEmail(input.email);
  const [existingUser] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, email))
    .limit(1);

  let userId = existingUser?.id;
  let tempPassword: string | undefined;

  if (!userId) {
    tempPassword = generateTemporaryPassword();

    if (!validatePasswordStrength(tempPassword)) {
      throw new Error("No se pudo generar una contraseña temporal válida.");
    }

    const [created] = await db
      .insert(appUsers)
      .values({
        email,
        fullName: input.fullName,
        userType: input.userType,
        status: "active",
        platformRole: "none",
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
        metadata: { provisionedBy: "platform_admin" }
      })
      .returning({ id: appUsers.id });

    if (!created) {
      throw new Error("No se pudo crear el usuario inicial.");
    }

    userId = created.id;
  }

  const [existingMembership] = await db
    .select({ id: userPropertyMemberships.id })
    .from(userPropertyMemberships)
    .where(
      and(
        eq(userPropertyMemberships.userId, userId),
        eq(userPropertyMemberships.propertyId, input.propertyId)
      )
    )
    .limit(1);

  if (existingMembership) {
    await db
      .update(userPropertyMemberships)
      .set({ role: input.role, status: "active", updatedAt: new Date() })
      .where(eq(userPropertyMemberships.id, existingMembership.id));
  } else {
    await db.insert(userPropertyMemberships).values({
      userId,
      propertyId: input.propertyId,
      role: input.role,
      status: "active"
    });
  }

  return {
    userId,
    email,
    role: input.role,
    ...(tempPassword ? { tempPassword } : {})
  };
}

async function createDemoTenantUsers(
  db: Pick<VoltariaDb, "insert" | "select" | "update">,
  propertyId: string,
  organizationSlug: string
) {
  return Promise.all([
    ensureTenantUser(db, {
      propertyId,
      email: `operations@${organizationSlug}.local`,
      fullName: "Operación",
      role: "operations",
      userType: "staff"
    }),
    ensureTenantUser(db, {
      propertyId,
      email: `accounting@${organizationSlug}.local`,
      fullName: "Contabilidad",
      role: "accounting",
      userType: "staff"
    })
  ]);
}

function generateTemporaryPassword() {
  return `Vt${randomBytes(10).toString("base64url")}aA1`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
