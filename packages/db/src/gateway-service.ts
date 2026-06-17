import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { VoltariaDb } from "./client";
import { gatewayDevices } from "./schema";

type DbExecutor = Pick<VoltariaDb, "insert" | "select" | "update">;

export type GatewayConfig = {
  gatewayCode: string;
  propertyId: string;
  organizationId: string;
  apiBaseUrl: string;
  mode: "simulator" | "local_gateway" | "milesight" | "plc" | "modbus" | "mqtt" | "http";
  authToken?: string;
  pollIntervalMs: number;
  meterIntervalMs: number;
};

export type GatewayProvisioningResult = {
  gatewayId: string;
  gatewayCode: string;
  authToken: string;
  config: GatewayConfig;
};

export async function createGateway(
  db: DbExecutor,
  input: {
    organizationId: string;
    propertyId: string;
    code: string;
    name: string;
    kind: "simulator" | "local_gateway" | "milesight" | "plc" | "modbus" | "mqtt" | "http";
    status?: "provisioned" | "online" | "offline" | "disabled" | "revoked";
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    apiBaseUrl?: string;
  }
): Promise<GatewayProvisioningResult> {
  const code = normalizeGatewayCode(input.code);
  const [existing] = await db
    .select({ id: gatewayDevices.id })
    .from(gatewayDevices)
    .where(eq(gatewayDevices.code, code))
    .limit(1);

  if (existing) {
    throw new Error("Ya existe un gateway con ese código.");
  }

  const authToken = generateGatewayToken();
  const now = new Date();
  const [gateway] = await db
    .insert(gatewayDevices)
    .values({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      code,
      name: input.name.trim(),
      kind: input.kind,
      status: input.status ?? "provisioned",
      authTokenHash: hashGatewayToken(authToken),
      tokenLastRotatedAt: now,
      config: input.config ?? {},
      metadata: input.metadata ?? {}
    })
    .returning();

  if (!gateway) {
    throw new Error("No se pudo crear el gateway.");
  }

  return {
    gatewayId: gateway.id,
    gatewayCode: gateway.code,
    authToken,
    config: generateGatewayConfigFromRow(gateway, {
      authToken,
      ...(input.apiBaseUrl ? { apiBaseUrl: input.apiBaseUrl } : {})
    })
  };
}

export async function rotateGatewayToken(
  db: DbExecutor,
  gatewayId: string,
  options: { apiBaseUrl?: string } = {}
): Promise<GatewayProvisioningResult> {
  const authToken = generateGatewayToken();
  const [gateway] = await db
    .update(gatewayDevices)
    .set({
      authTokenHash: hashGatewayToken(authToken),
      tokenLastRotatedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(gatewayDevices.id, gatewayId))
    .returning();

  if (!gateway) {
    throw new Error("Gateway no encontrado.");
  }

  return {
    gatewayId: gateway.id,
    gatewayCode: gateway.code,
    authToken,
    config: generateGatewayConfigFromRow(gateway, {
      authToken,
      ...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {})
    })
  };
}

export async function revokeGateway(db: DbExecutor, gatewayId: string) {
  const [gateway] = await db
    .update(gatewayDevices)
    .set({
      status: "revoked",
      authTokenHash: null,
      disabledAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(gatewayDevices.id, gatewayId))
    .returning();

  if (!gateway) {
    throw new Error("Gateway no encontrado.");
  }

  return gateway;
}

export async function getGatewayByCode(db: DbExecutor, code: string) {
  const [gateway] = await db
    .select()
    .from(gatewayDevices)
    .where(eq(gatewayDevices.code, normalizeGatewayCode(code)))
    .limit(1);

  return gateway ?? null;
}

export async function validateGatewayToken(db: DbExecutor, code: string, token: string) {
  const gateway = await getGatewayByCode(db, code);

  if (!gateway || gateway.status === "revoked" || gateway.status === "disabled") {
    return null;
  }

  if (!gateway.authTokenHash || gateway.authTokenHash !== hashGatewayToken(token)) {
    return null;
  }

  return gateway;
}

export async function updateGatewayHeartbeat(
  db: DbExecutor,
  input: {
    code: string;
    token?: string;
    status?: "online" | "offline";
    lastIp?: string;
    version?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const gateway = input.token
    ? await validateGatewayToken(db, input.code, input.token)
    : await getGatewayByCode(db, input.code);

  if (!gateway) {
    throw new Error("Gateway no autorizado o no encontrado.");
  }

  const [updated] = await db
    .update(gatewayDevices)
    .set({
      status: input.status ?? "online",
      lastSeenAt: new Date(),
      lastIp: input.lastIp ?? gateway.lastIp,
      version: input.version ?? gateway.version,
      metadata: input.metadata ? { ...gateway.metadata, ...input.metadata } : gateway.metadata,
      updatedAt: new Date()
    })
    .where(eq(gatewayDevices.id, gateway.id))
    .returning();

  return updated ?? gateway;
}

export async function generateGatewayConfig(
  db: DbExecutor,
  gatewayId: string,
  options: { authToken?: string; apiBaseUrl?: string } = {}
): Promise<GatewayConfig> {
  const [gateway] = await db
    .select()
    .from(gatewayDevices)
    .where(eq(gatewayDevices.id, gatewayId))
    .limit(1);

  if (!gateway) {
    throw new Error("Gateway no encontrado.");
  }

  return generateGatewayConfigFromRow(gateway, options);
}

export async function getGatewaysForProperty(db: DbExecutor, propertyId: string) {
  return db
    .select()
    .from(gatewayDevices)
    .where(eq(gatewayDevices.propertyId, propertyId));
}

export function generateGatewayToken() {
  return `vgt_${randomBytes(32).toString("base64url")}`;
}

export function hashGatewayToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeGatewayCode(code: string) {
  return code.trim().toUpperCase();
}

function generateGatewayConfigFromRow(
  gateway: typeof gatewayDevices.$inferSelect,
  options: { authToken?: string; apiBaseUrl?: string } = {}
): GatewayConfig {
  return {
    gatewayCode: gateway.code,
    propertyId: gateway.propertyId,
    organizationId: gateway.organizationId,
    apiBaseUrl: options.apiBaseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    mode: gateway.kind,
    ...(options.authToken ? { authToken: options.authToken } : {}),
    pollIntervalMs: getPositiveInt(gateway.config.pollIntervalMs, 3000),
    meterIntervalMs: getPositiveInt(gateway.config.meterIntervalMs, 10000)
  };
}

function getPositiveInt(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}
