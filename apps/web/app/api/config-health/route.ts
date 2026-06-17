import { NextResponse } from "next/server";
import { createDbClientIfConfigured, getPlatformConfigHealthCounts, loadDatabaseEnv } from "@voltaria/db";
import { getDeploymentConfigStatus } from "@/lib/deployment";

loadDatabaseEnv();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = getDeploymentConfigStatus();
  let organizationsCount: number | null = null;
  let gatewaysCount: number | null = null;
  let gatewaysOnlineCount: number | null = null;
  let gatewaysOfflineCount: number | null = null;
  let stuckCommandsCount: number | null = null;
  let stuckSessionsCount: number | null = null;

  const context = createDbClientIfConfigured();

  if (context) {
    try {
      const counts = await getPlatformConfigHealthCounts(context.db);
      organizationsCount = counts.organizationsCount;
      gatewaysCount = counts.gatewaysCount;
      gatewaysOnlineCount = counts.gatewaysOnlineCount;
      gatewaysOfflineCount = counts.gatewaysOfflineCount;
      stuckCommandsCount = counts.stuckCommandsCount;
      stuckSessionsCount = counts.stuckSessionsCount;
    } catch {
      organizationsCount = null;
      gatewaysCount = null;
      gatewaysOnlineCount = null;
      gatewaysOfflineCount = null;
      stuckCommandsCount = null;
      stuckSessionsCount = null;
    } finally {
      await context.client.end();
    }
  }

  return NextResponse.json({
    ...status,
    organizationsCount,
    gatewaysCount,
    gatewayHealth: {
      onlineCount: gatewaysOnlineCount,
      offlineCount: gatewaysOfflineCount
    },
    workerHealth: {
      stuckCommandsCount,
      stuckSessionsCount
    },
    workerConfig: {
      workerScopeConfigured: Boolean(process.env.WORKER_SCOPE?.trim()),
      gatewayCodeConfigured: Boolean(process.env.WORKER_GATEWAY_CODE?.trim())
    }
  }, {
    status: status.status === "ok" ? 200 : 503
  });
}
