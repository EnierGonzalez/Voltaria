import { NextResponse } from "next/server";
import { createDbClient, loadDatabaseEnv, updateGatewayHeartbeat } from "@voltaria/db";
import { gatewayCodeSchema } from "@voltaria/shared";

loadDatabaseEnv();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = getGatewayToken(request);

  if (!token) {
    return NextResponse.json({ status: "error", message: "Gateway token requerido." }, { status: 401 });
  }

  let payload: { gatewayCode: string; status: "online" | "offline"; version?: string };

  try {
    payload = parseHeartbeatPayload(await request.json());
  } catch {
    return NextResponse.json({ status: "error", message: "Payload inválido." }, { status: 400 });
  }

  const context = createDbClient();

  try {
    const updated = await updateGatewayHeartbeat(context.db, {
      code: payload.gatewayCode,
      token,
      status: payload.status,
      ...(payload.version ? { version: payload.version } : {}),
      ...getRequestIp(request)
    });

    return NextResponse.json({
      status: "ok",
      gatewayCode: updated.code,
      gatewayStatus: updated.status,
      lastSeenAt: updated.lastSeenAt?.toISOString() ?? null
    });
  } catch {
    return NextResponse.json({ status: "error", message: "Gateway no autorizado." }, { status: 401 });
  } finally {
    await context.client.end();
  }
}

function parseHeartbeatPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid payload.");
  }

  const source = value as Record<string, unknown>;
  const gatewayCode = gatewayCodeSchema.parse(source.gatewayCode);
  const status: "online" | "offline" = source.status === "offline" ? "offline" : "online";
  const version = typeof source.version === "string" ? source.version.trim().slice(0, 80) : undefined;

  return {
    gatewayCode,
    status,
    ...(version ? { version } : {})
  };
}

function getRequestIp(request: Request) {
  const lastIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return lastIp ? { lastIp } : {};
}

function getGatewayToken(request: Request) {
  const explicit = request.headers.get("x-voltaria-gateway-token")?.trim();

  if (explicit) {
    return explicit;
  }

  const authorization = request.headers.get("authorization")?.trim();

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return null;
}
