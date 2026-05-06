import { NextResponse } from "next/server";
import { loadDatabaseEnv } from "@voltaria/db";
import { getDeploymentConfigStatus } from "@/lib/deployment";

loadDatabaseEnv();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const status = getDeploymentConfigStatus();

  return NextResponse.json(status, {
    status: status.status === "ok" ? 200 : 503
  });
}
