import { NextResponse } from "next/server";
import { getAppEnv } from "@/lib/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    app: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Voltaria",
    env: getAppEnv(),
    timestamp: new Date().toISOString()
  });
}
