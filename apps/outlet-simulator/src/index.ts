import { createServer, type Server } from "node:http";
import { hostname } from "node:os";
import {
  createMigrationDbClient,
  loadDatabaseEnv,
  pingDatabase,
  runOutletSimulatorTick,
  updateGatewayHeartbeat,
  updateSimulatorGatewayHeartbeats,
  validateGatewayToken,
  type OutletSimulatorRunOptions
} from "@voltaria/db";

const APP_ENV = process.env.APP_ENV?.trim() || "development";
const POLL_INTERVAL_MS = getPositiveInt(process.env.OUTLET_SIMULATOR_POLL_INTERVAL_MS, 3_000);
const METER_INTERVAL_MS = getPositiveInt(process.env.OUTLET_SIMULATOR_METER_INTERVAL_MS, 10_000);
const HEARTBEAT_INTERVAL_MS = getPositiveInt(process.env.OUTLET_SIMULATOR_HEARTBEAT_INTERVAL_MS, 30_000);
const BACKOFF_STEPS_MS = [3_000, 5_000, 10_000, 30_000, 60_000] as const;

loadDatabaseEnv();

let shuttingDown = false;
let sleepTimeout: NodeJS.Timeout | null = null;
let wakeSleep: (() => void) | null = null;
let healthServer: Server | null = null;

const context = createMigrationDbClient();

void main().catch(async (error) => {
  logError("worker fatal error", error);
  await context.client.end();
  process.exit(1);
});

async function main() {
  const worker = await loadWorkerOptionsWithRetry();
  healthServer = startHealthServer(worker);

  logInfo("worker started", {
    appEnv: APP_ENV,
    scope: worker.scope ?? "all_simulated",
    workerInstanceId: worker.workerInstanceId ?? "outlet-simulator",
    propertyId: worker.propertyId,
    gatewayCode: worker.gatewayCode,
    pollIntervalMs: POLL_INTERVAL_MS,
    meterIntervalMs: METER_INTERVAL_MS,
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS
  });

  let consecutiveFailures = 0;
  let lastHeartbeatAt = 0;

  while (!shuttingDown) {
    try {
      const now = Date.now();

      if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
        const heartbeatCount = await sendHeartbeat(worker);
        lastHeartbeatAt = now;
        logInfo("heartbeat", {
          scope: worker.scope ?? "all_simulated",
          gatewaysUpdated: heartbeatCount
        });
      }

      const result = await runOutletSimulatorTick(context.db, {
        ...worker,
        meterIntervalMs: METER_INTERVAL_MS
      });

      consecutiveFailures = 0;

      if (hasRuntimeActivity(result)) {
        logInfo("tick processed", {
          commandsProcessed: result.processedCommands,
          meterValuesGenerated: result.meterValues,
          timedOutSessions: result.timedOutSessions,
          noLoadSessions: result.noLoadSessions,
          overCurrentSessions: result.overCurrentSessions,
          ruleStoppedSessions: result.ruleStoppedSessions
        });
      }

      await wait(POLL_INTERVAL_MS);
    } catch (error) {
      consecutiveFailures += 1;
      const backoffMs = getBackoffMs(consecutiveFailures);
      logError("tick failed; backing off", error, { backoffMs });
      await wait(backoffMs);
    }
  }

  await closeResources();
}

async function loadWorkerOptionsWithRetry() {
  let attempts = 0;

  while (!shuttingDown) {
    try {
      return await loadWorkerOptions();
    } catch (error) {
      if (isFatalWorkerConfigError(error)) {
        throw error;
      }

      attempts += 1;
      const backoffMs = getBackoffMs(attempts);
      logError("worker startup database check failed; retrying", error, { backoffMs });
      await wait(backoffMs);
    }
  }

  throw new Error("Worker stopped before startup completed.");
}

async function sendHeartbeat(worker: WorkerOptions) {
  if (worker.scope === "gateway" && worker.gatewayCode && process.env.WORKER_GATEWAY_TOKEN) {
    await updateGatewayHeartbeat(context.db, {
      code: worker.gatewayCode,
      token: process.env.WORKER_GATEWAY_TOKEN,
      status: "online",
      version: process.env.npm_package_version ?? "dev",
      metadata: { workerInstanceId: worker.workerInstanceId }
    });
    return 1;
  }

  if (worker.scope === "property" && worker.propertyId) {
    return updateSimulatorGatewayHeartbeats(context.db, {
      workerInstanceId: worker.workerInstanceId ?? "outlet-simulator",
      propertyId: worker.propertyId,
      version: process.env.npm_package_version ?? "dev"
    });
  }

  return updateSimulatorGatewayHeartbeats(context.db, {
    workerInstanceId: worker.workerInstanceId ?? "outlet-simulator",
    version: process.env.npm_package_version ?? "dev"
  });
}

async function loadWorkerOptions(): Promise<WorkerOptions> {
  const scope = parseScope(process.env.WORKER_SCOPE);
  const workerInstanceId =
    process.env.WORKER_INSTANCE_ID?.trim() ||
    `outlet-simulator-${hostname()}-${process.pid}-${Date.now().toString(36)}`;

  if (scope === "property") {
    const propertyId = process.env.WORKER_PROPERTY_ID?.trim();

    if (!propertyId) {
      throw new Error("WORKER_PROPERTY_ID is required when WORKER_SCOPE=property.");
    }

    return { scope, workerInstanceId, propertyId };
  }

  if (scope === "gateway") {
    const gatewayCode = process.env.WORKER_GATEWAY_CODE?.trim();
    const gatewayToken = process.env.WORKER_GATEWAY_TOKEN?.trim();

    if (!gatewayCode || !gatewayToken) {
      throw new Error("WORKER_GATEWAY_CODE and WORKER_GATEWAY_TOKEN are required when WORKER_SCOPE=gateway.");
    }

    const gateway = await validateGatewayToken(context.db, gatewayCode, gatewayToken);

    if (!gateway) {
      throw new Error("Gateway credentials are invalid, disabled or revoked.");
    }

    await updateGatewayHeartbeat(context.db, {
      code: gatewayCode,
      token: gatewayToken,
      status: "online",
      version: process.env.npm_package_version ?? "dev",
      metadata: { workerInstanceId }
    });

    return { scope, workerInstanceId, gatewayId: gateway.id, propertyId: gateway.propertyId, gatewayCode };
  }

  return { scope: "all_simulated", workerInstanceId };
}

function startHealthServer(worker: WorkerOptions) {
  const port = getOptionalPort(process.env.PORT);

  if (!port) {
    return null;
  }

  const startedAt = Date.now();
  const server = createServer((request, response) => {
    if (request.url === "/health") {
      writeJson(response, 200, {
        status: "ok",
        workerInstanceId: worker.workerInstanceId,
        scope: worker.scope ?? "all_simulated",
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
      });
      return;
    }

    if (request.url === "/ready") {
      void pingDatabase(context.db)
        .then(() => {
          writeJson(response, 200, {
            status: "ok",
            database: "reachable"
          });
        })
        .catch(() => {
          writeJson(response, 503, {
            status: "error",
            database: "unreachable"
          });
        });
      return;
    }

    writeJson(response, 404, { status: "not_found" });
  });

  server.listen(port, () => {
    logInfo("health server listening", { port });
  });

  return server;
}

function requestShutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`worker shutting down signal=${signal}`);

  if (sleepTimeout) {
    clearTimeout(sleepTimeout);
    sleepTimeout = null;
  }

  wakeSleep?.();
  wakeSleep = null;
}

async function closeResources() {
  if (healthServer) {
    await new Promise<void>((resolve) => {
      healthServer?.close(() => resolve());
    });
  }

  await context.client.end();
  console.log("worker stopped");
}

function wait(ms: number) {
  if (shuttingDown) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    wakeSleep = resolve;
    sleepTimeout = setTimeout(() => {
      sleepTimeout = null;
      wakeSleep = null;
      resolve();
    }, ms);
  });
}

function hasRuntimeActivity(result: {
  processedCommands: number;
  meterValues: number;
  timedOutSessions: number;
  noLoadSessions: number;
  overCurrentSessions: number;
  ruleStoppedSessions: number;
}) {
  return (
    result.processedCommands > 0 ||
    result.meterValues > 0 ||
    result.timedOutSessions > 0 ||
    result.noLoadSessions > 0 ||
    result.overCurrentSessions > 0 ||
    result.ruleStoppedSessions > 0
  );
}

function parseScope(value: string | undefined) {
  if (value === "property" || value === "gateway" || value === "all_simulated") {
    return value;
  }

  return "all_simulated";
}

function getPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function getOptionalPort(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65_536 ? parsed : null;
}

function getBackoffMs(failures: number) {
  return BACKOFF_STEPS_MS[Math.min(Math.max(failures - 1, 0), BACKOFF_STEPS_MS.length - 1)] ?? 60_000;
}

function isFatalWorkerConfigError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("WORKER_PROPERTY_ID is required") ||
    error.message.includes("WORKER_GATEWAY_CODE and WORKER_GATEWAY_TOKEN") ||
    error.message.includes("Gateway credentials are invalid")
  );
}

function logInfo(message: string, details: Record<string, unknown>) {
  console.log(`${message} ${formatLogDetails(details)}`.trim());
}

function logError(message: string, error: unknown, details: Record<string, unknown> = {}) {
  const errorMessage = error instanceof Error ? error.message : "unknown_error";
  console.error(`${message} error=${JSON.stringify(errorMessage)} ${formatLogDetails(details)}`.trim());
}

function formatLogDetails(details: Record<string, unknown>) {
  return Object.entries(details)
    .filter(([, value]) => typeof value !== "undefined" && value !== null && value !== "")
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
}

function writeJson(response: import("node:http").ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

process.on("SIGINT", requestShutdown);
process.on("SIGTERM", requestShutdown);

type WorkerOptions = OutletSimulatorRunOptions & { gatewayCode?: string };
