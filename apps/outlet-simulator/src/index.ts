import {
  createMigrationDbClient,
  loadDatabaseEnv,
  runOutletSimulatorTick,
  updateGatewayHeartbeat,
  validateGatewayToken,
  type OutletSimulatorRunOptions
} from "@voltaria/db";

const POLL_INTERVAL_MS = getPositiveInt(process.env.OUTLET_SIMULATOR_POLL_INTERVAL_MS, 3_000);
const METER_INTERVAL_MS = getPositiveInt(process.env.OUTLET_SIMULATOR_METER_INTERVAL_MS, 10_000);

loadDatabaseEnv();

const context = createMigrationDbClient();
const worker = await loadWorkerOptions();
let running = false;
let shuttingDown = false;

console.log(
  [
    "Voltaria outlet simulator started.",
    `scope=${worker.scope}`,
    `worker=${worker.workerInstanceId}`,
    worker.propertyId ? `property=${worker.propertyId}` : null,
    worker.gatewayId ? `gateway=${worker.gatewayCode}` : null
  ]
    .filter(Boolean)
    .join(" ")
);

async function tick() {
  if (running || shuttingDown) {
    return;
  }

  running = true;

  try {
    if (worker.scope === "gateway" && worker.gatewayCode && process.env.WORKER_GATEWAY_TOKEN) {
      await updateGatewayHeartbeat(context.db, {
        code: worker.gatewayCode,
        token: process.env.WORKER_GATEWAY_TOKEN,
        status: "online",
        version: process.env.npm_package_version ?? "dev",
        metadata: { workerInstanceId: worker.workerInstanceId }
      });
    }

    const result = await runOutletSimulatorTick(context.db, {
      ...worker,
      meterIntervalMs: METER_INTERVAL_MS
    });

    if (
      result.processedCommands > 0 ||
      result.meterValues > 0 ||
      result.timedOutSessions > 0 ||
      result.noLoadSessions > 0 ||
      result.overCurrentSessions > 0 ||
      result.ruleStoppedSessions > 0
    ) {
      console.log(
        [
          `commands=${result.processedCommands}`,
          `meter_values=${result.meterValues}`,
          `timeouts=${result.timedOutSessions}`,
          `no_load=${result.noLoadSessions}`,
          `over_current=${result.overCurrentSessions}`,
          `rule_stops=${result.ruleStoppedSessions}`
        ].join(" ")
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Outlet simulator tick failed.");
  } finally {
    running = false;
  }
}

const interval = setInterval(() => {
  void tick();
}, POLL_INTERVAL_MS);

void tick();

async function shutdown(signal: NodeJS.Signals) {
  shuttingDown = true;
  clearInterval(interval);
  console.log(`Stopping outlet simulator (${signal}).`);
  await context.client.end();
}

process.on("SIGINT", (signal) => {
  void shutdown(signal).then(() => process.exit(0));
});

async function loadWorkerOptions(): Promise<
  OutletSimulatorRunOptions & { gatewayCode?: string }
> {
  const scope = parseScope(process.env.WORKER_SCOPE);
  const workerInstanceId =
    process.env.WORKER_INSTANCE_ID?.trim() ||
    `outlet-simulator-${process.pid}-${Date.now().toString(36)}`;

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
      throw new Error("Gateway credentials are invalid or revoked.");
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

process.on("SIGTERM", (signal) => {
  void shutdown(signal).then(() => process.exit(0));
});
