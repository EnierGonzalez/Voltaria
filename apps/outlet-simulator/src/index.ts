import { createDbClient, loadDatabaseEnv, runOutletSimulatorTick } from "@voltaria/db";

const POLL_INTERVAL_MS = 3_000;

loadDatabaseEnv();

const context = createDbClient();
let running = false;
let shuttingDown = false;

console.log("Voltaria outlet simulator started.");

async function tick() {
  if (running || shuttingDown) {
    return;
  }

  running = true;

  try {
    const result = await runOutletSimulatorTick(context.db);

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

process.on("SIGTERM", (signal) => {
  void shutdown(signal).then(() => process.exit(0));
});
