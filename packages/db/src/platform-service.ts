import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { VoltariaDb } from "./client";
import {
  alerts,
  chargers,
  chargingSessions,
  gatewayDevices,
  organizations,
  properties,
  tariffs,
  userPropertyMemberships
} from "./schema";

export type PlatformDashboardSummary = {
  totalTenants: number;
  activeTenants: number;
  totalProperties: number;
  totalOutlets: number;
  gatewaysOnline: number;
  gatewaysOffline: number;
  activeSessions: number;
  openAlerts: number;
};

export type PlatformTenantSummary = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  primaryPropertySlug: string | null;
  propertiesCount: number;
  gatewaysCount: number;
  outletsCount: number;
  createdAt: string;
};

export type PlatformGatewaySummary = {
  id: string;
  organizationId: string;
  organizationName: string;
  propertyId: string;
  propertyName: string;
  code: string;
  name: string;
  kind: string;
  status: string;
  lastSeenAt: string | null;
  version: string | null;
  createdAt: string;
};

export type PlatformTenantDetail = PlatformTenantSummary & {
  properties: Array<{
    id: string;
    name: string;
    slug: string;
    address: string | null;
    timezone: string;
    billingCurrency: string;
    outletsCount: number;
    sessionsCount: number;
    usersCount: number;
    gatewaysCount: number;
  }>;
  gateways: PlatformGatewaySummary[];
  usersCount: number;
  activeTariffsCount: number;
};

export type TenantPropertyContext = {
  property: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    timezone: string;
    billingCurrency: string;
    organizationId: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: string;
  } | null;
};

export type TenantIsolationDiagnostic = {
  organizationId: string | null;
  organizationName: string;
  organizationSlug: string | null;
  propertyId: string | null;
  propertyName: string;
  propertySlug: string | null;
  outletsCount: number;
  sessionsCount: number;
  gatewaysCount: number;
  usersCount: number;
  warnings: string[];
};

export async function getTenantPropertyContextByPropertySlug(
  db: VoltariaDb,
  propertySlug: string
): Promise<TenantPropertyContext | null> {
  const rows = await getTenantPropertyContextsByPropertySlug(db, propertySlug);

  return rows.length === 1 ? rows[0] ?? null : null;
}

export async function getTenantPropertyContextsByPropertySlug(
  db: VoltariaDb,
  propertySlug: string
): Promise<TenantPropertyContext[]> {
  const rows = await db
    .select({
      propertyId: properties.id,
      propertyName: properties.name,
      propertySlug: properties.slug,
      propertyAddress: properties.address,
      propertyTimezone: properties.timezone,
      propertyBillingCurrency: properties.billingCurrency,
      organizationId: properties.organizationId,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      organizationStatus: organizations.status,
      organizationPlan: organizations.plan
    })
    .from(properties)
    .leftJoin(organizations, eq(organizations.id, properties.organizationId))
    .where(eq(properties.slug, propertySlug));

  return rows.map((row) => ({
    property: {
      id: row.propertyId,
      name: row.propertyName,
      slug: row.propertySlug,
      address: row.propertyAddress,
      timezone: row.propertyTimezone,
      billingCurrency: row.propertyBillingCurrency,
      organizationId: row.organizationId
    },
    organization: row.organizationId
      ? {
          id: row.organizationId,
          name: row.organizationName ?? "Sin organización",
          slug: row.organizationSlug ?? "sin-organizacion",
          status: row.organizationStatus ?? "active",
          plan: row.organizationPlan ?? "demo"
        }
      : null
  }));
}

export async function getTenantPropertyContextBySlugs(
  db: VoltariaDb,
  organizationSlug: string,
  propertySlug: string
): Promise<TenantPropertyContext | null> {
  const [row] = await db
    .select({
      propertyId: properties.id,
      propertyName: properties.name,
      propertySlug: properties.slug,
      propertyAddress: properties.address,
      propertyTimezone: properties.timezone,
      propertyBillingCurrency: properties.billingCurrency,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      organizationStatus: organizations.status,
      organizationPlan: organizations.plan
    })
    .from(organizations)
    .innerJoin(properties, eq(properties.organizationId, organizations.id))
    .where(and(eq(organizations.slug, organizationSlug), eq(properties.slug, propertySlug)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    property: {
      id: row.propertyId,
      name: row.propertyName,
      slug: row.propertySlug,
      address: row.propertyAddress,
      timezone: row.propertyTimezone,
      billingCurrency: row.propertyBillingCurrency,
      organizationId: row.organizationId
    },
    organization: {
      id: row.organizationId,
      name: row.organizationName,
      slug: row.organizationSlug,
      status: row.organizationStatus,
      plan: row.organizationPlan
    }
  };
}

export async function getPlatformDashboardSummary(
  db: VoltariaDb
): Promise<PlatformDashboardSummary> {
  const [tenants] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${organizations.status} in ('active', 'trial'))::int`
    })
    .from(organizations);
  const [propertiesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(properties);
  const [outletsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chargers)
    .where(eq(chargers.kind, "controlled_outlet"));
  const [gateways] = await db
    .select({
      online: sql<number>`count(*) filter (where ${gatewayDevices.status} = 'online')::int`,
      offline: sql<number>`count(*) filter (where ${gatewayDevices.status} in ('provisioned', 'offline'))::int`
    })
    .from(gatewayDevices);
  const [sessions] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chargingSessions)
    .where(eq(chargingSessions.status, "active"));
  const [openAlerts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alerts)
    .where(eq(alerts.status, "open"));

  return {
    totalTenants: tenants?.total ?? 0,
    activeTenants: tenants?.active ?? 0,
    totalProperties: propertiesCount?.count ?? 0,
    totalOutlets: outletsCount?.count ?? 0,
    gatewaysOnline: gateways?.online ?? 0,
    gatewaysOffline: gateways?.offline ?? 0,
    activeSessions: sessions?.count ?? 0,
    openAlerts: openAlerts?.count ?? 0
  };
}

export async function getPlatformTenants(db: VoltariaDb): Promise<PlatformTenantSummary[]> {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      status: organizations.status,
      contactName: organizations.contactName,
      contactEmail: organizations.contactEmail,
      createdAt: organizations.createdAt,
      primaryPropertySlug: sql<string | null>`min(${properties.slug}) filter (where ${properties.id} is not null)`,
      propertiesCount: sql<number>`count(distinct ${properties.id})::int`,
      gatewaysCount: sql<number>`count(distinct ${gatewayDevices.id})::int`,
      outletsCount: sql<number>`count(distinct ${chargers.id}) filter (where ${chargers.kind} = 'controlled_outlet')::int`
    })
    .from(organizations)
    .leftJoin(properties, eq(properties.organizationId, organizations.id))
    .leftJoin(gatewayDevices, eq(gatewayDevices.organizationId, organizations.id))
    .leftJoin(chargers, eq(chargers.propertyId, properties.id))
    .groupBy(organizations.id)
    .orderBy(desc(organizations.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function updatePlatformTenantStatus(
  db: VoltariaDb,
  organizationId: string,
  status: "active" | "trial" | "suspended" | "disabled"
) {
  const [organization] = await db
    .update(organizations)
    .set({
      status,
      disabledAt: status === "disabled" ? new Date() : null,
      updatedAt: new Date()
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  if (!organization) {
    throw new Error("Tenant no encontrado.");
  }

  return organization;
}

export async function getPlatformTenantDetail(
  db: VoltariaDb,
  organizationId: string
): Promise<PlatformTenantDetail | null> {
  const tenant = (await getPlatformTenants(db)).find((item) => item.id === organizationId);

  if (!tenant) {
    return null;
  }

  const propertyRows = await db
    .select({
      id: properties.id,
      name: properties.name,
      slug: properties.slug,
      address: properties.address,
      timezone: properties.timezone,
      billingCurrency: properties.billingCurrency,
      outletsCount: sql<number>`count(distinct ${chargers.id}) filter (where ${chargers.kind} = 'controlled_outlet')::int`,
      sessionsCount: sql<number>`count(distinct ${chargingSessions.id})::int`,
      usersCount: sql<number>`count(distinct ${userPropertyMemberships.userId})::int`,
      gatewaysCount: sql<number>`count(distinct ${gatewayDevices.id})::int`
    })
    .from(properties)
    .leftJoin(chargers, eq(chargers.propertyId, properties.id))
    .leftJoin(chargingSessions, eq(chargingSessions.propertyId, properties.id))
    .leftJoin(userPropertyMemberships, eq(userPropertyMemberships.propertyId, properties.id))
    .leftJoin(gatewayDevices, eq(gatewayDevices.propertyId, properties.id))
    .where(eq(properties.organizationId, organizationId))
    .groupBy(properties.id)
    .orderBy(properties.createdAt);

  const [usersCount] = await db
    .select({ count: sql<number>`count(distinct ${userPropertyMemberships.userId})::int` })
    .from(userPropertyMemberships)
    .innerJoin(properties, eq(properties.id, userPropertyMemberships.propertyId))
    .where(eq(properties.organizationId, organizationId));

  const [activeTariffs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tariffs)
    .innerJoin(properties, eq(properties.id, tariffs.propertyId))
    .where(sql`${properties.organizationId} = ${organizationId} and ${tariffs.isActive} = true`);

  return {
    ...tenant,
    properties: propertyRows,
    gateways: (await getPlatformGateways(db)).filter((gateway) => gateway.organizationId === organizationId),
    usersCount: usersCount?.count ?? 0,
    activeTariffsCount: activeTariffs?.count ?? 0
  };
}

export async function getPlatformGateways(db: VoltariaDb): Promise<PlatformGatewaySummary[]> {
  const rows = await db
    .select({
      id: gatewayDevices.id,
      organizationId: gatewayDevices.organizationId,
      organizationName: organizations.name,
      propertyId: gatewayDevices.propertyId,
      propertyName: properties.name,
      code: gatewayDevices.code,
      name: gatewayDevices.name,
      kind: gatewayDevices.kind,
      status: gatewayDevices.status,
      lastSeenAt: gatewayDevices.lastSeenAt,
      version: gatewayDevices.version,
      createdAt: gatewayDevices.createdAt
    })
    .from(gatewayDevices)
    .innerJoin(organizations, eq(organizations.id, gatewayDevices.organizationId))
    .innerJoin(properties, eq(properties.id, gatewayDevices.propertyId))
    .orderBy(desc(gatewayDevices.createdAt));

  return rows.map((row) => ({
    ...row,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function getPlatformConfigHealthCounts(db: VoltariaDb) {
  const [orgs] = await db.select({ count: sql<number>`count(*)::int` }).from(organizations);
  const [gateways] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gatewayDevices);

  return {
    organizationsCount: orgs?.count ?? 0,
    gatewaysCount: gateways?.count ?? 0
  };
}

export async function getTenantIsolationDiagnostics(
  db: VoltariaDb
): Promise<TenantIsolationDiagnostic[]> {
  const propertyRows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      propertyId: properties.id,
      propertyName: properties.name,
      propertySlug: properties.slug,
      outletsCount: sql<number>`count(distinct ${chargers.id}) filter (where ${chargers.kind} = 'controlled_outlet')::int`,
      sessionsCount: sql<number>`count(distinct ${chargingSessions.id})::int`,
      gatewaysCount: sql<number>`count(distinct ${gatewayDevices.id})::int`,
      usersCount: sql<number>`count(distinct ${userPropertyMemberships.userId})::int`
    })
    .from(properties)
    .leftJoin(organizations, eq(organizations.id, properties.organizationId))
    .leftJoin(chargers, eq(chargers.propertyId, properties.id))
    .leftJoin(chargingSessions, eq(chargingSessions.propertyId, properties.id))
    .leftJoin(gatewayDevices, eq(gatewayDevices.propertyId, properties.id))
    .leftJoin(userPropertyMemberships, eq(userPropertyMemberships.propertyId, properties.id))
    .groupBy(properties.id, organizations.id)
    .orderBy(organizations.name, properties.name);

  const orphanGateways = await db
    .select({
      id: gatewayDevices.id,
      organizationId: gatewayDevices.organizationId,
      propertyId: gatewayDevices.propertyId,
      propertyOrganizationId: properties.organizationId
    })
    .from(gatewayDevices)
    .leftJoin(properties, eq(properties.id, gatewayDevices.propertyId))
    .where(
      sql`${properties.id} is null or ${gatewayDevices.organizationId} is distinct from ${properties.organizationId}`
    );

  const duplicateRows = await db
    .select({
      organizationId: properties.organizationId,
      slug: properties.slug,
      count: sql<number>`count(*)::int`
    })
    .from(properties)
    .where(sql`${properties.organizationId} is not null`)
    .groupBy(properties.organizationId, properties.slug)
    .having(sql`count(*) > 1`);

  const propertyWithoutOrganization = await db
    .select({ id: properties.id })
    .from(properties)
    .where(isNull(properties.organizationId));

  const warningByProperty = new Map<string, string[]>();

  for (const gateway of orphanGateways) {
    const key = gateway.propertyId;
    const warnings = warningByProperty.get(key) ?? [];
    warnings.push("Gateway con organization/property inconsistente");
    warningByProperty.set(key, warnings);
  }

  for (const duplicate of duplicateRows) {
    const matching = propertyRows.filter(
      (row) => row.organizationId === duplicate.organizationId && row.propertySlug === duplicate.slug
    );

    for (const row of matching) {
      if (!row.propertyId) continue;
      const warnings = warningByProperty.get(row.propertyId) ?? [];
      warnings.push("Slug duplicado dentro de la organización");
      warningByProperty.set(row.propertyId, warnings);
    }
  }

  for (const property of propertyWithoutOrganization) {
    const warnings = warningByProperty.get(property.id) ?? [];
    warnings.push("Propiedad sin organización");
    warningByProperty.set(property.id, warnings);
  }

  return propertyRows.map((row) => ({
    organizationId: row.organizationId,
    organizationName: row.organizationName ?? "Sin organización",
    organizationSlug: row.organizationSlug,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    propertySlug: row.propertySlug,
    outletsCount: row.outletsCount ?? 0,
    sessionsCount: row.sessionsCount ?? 0,
    gatewaysCount: row.gatewaysCount ?? 0,
    usersCount: row.usersCount ?? 0,
    warnings: row.propertyId ? warningByProperty.get(row.propertyId) ?? [] : []
  }));
}
