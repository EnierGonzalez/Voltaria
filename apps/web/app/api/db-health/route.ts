import { NextResponse } from "next/server";
import { createDbClientIfConfigured, loadDatabaseEnv, pingDatabase } from "@voltaria/db";

loadDatabaseEnv();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = createDbClientIfConfigured();

  if (!context) {
    return NextResponse.json(
      { status: "error", database: "unreachable", reason: "database_url_missing" },
      { status: 503 }
    );
  }

  try {
    await pingDatabase(context.db);
    return NextResponse.json({ status: "ok", database: "reachable" });
  } catch {
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503 }
    );
  } finally {
    await context.client.end();
  }
}
