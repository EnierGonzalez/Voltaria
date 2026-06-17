import { NextResponse } from "next/server";
import {
  auditSessionsForPeriod,
  createDbClient,
  exportJobs,
  getSessionAuditSummaries,
  loadDatabaseEnv
} from "@voltaria/db";
import { reportsPeriodQuerySchema, toCsv } from "@voltaria/shared";
import { getCurrentUser } from "@/lib/auth";
import { resolveTenantExportScope } from "@/lib/export-scope";

loadDatabaseEnv();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  if (!user.permissions.includes("reports.export")) {
    return NextResponse.json({ error: "No tienes permiso para exportar reportes." }, { status: 403 });
  }

  const { db, client } = createDbClient();

  try {
    const scope = await resolveTenantExportScope(db, user, request.url);

    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const range = parseRange(request.url, scope.propertyId);

    if (!range.ok) {
      return NextResponse.json({ error: range.error }, { status: 400 });
    }

    await auditSessionsForPeriod(db, scope.propertyId, range.startDate, range.endDate);

    const audits = (await getSessionAuditSummaries(db, scope.propertyId, 1000)).filter((audit) => {
      const startedAt = new Date(audit.sessionStartedAt);
      return startedAt >= range.startDate && startedAt < range.endDate;
    });
    const rows = audits.map((audit) => ({
      session_id: audit.sessionId,
      audit_status: audit.auditStatus,
      energy_status: audit.energyStatus,
      command_status: audit.commandStatus,
      rule_status: audit.ruleStatus,
      billing_status: audit.billingStatus,
      reason: summarizeDetails(audit.details),
      notas: audit.notes ?? ""
    }));
    const csv = toCsv(rows, [
      { key: "session_id", header: "session_id" },
      { key: "audit_status", header: "audit_status" },
      { key: "energy_status", header: "energy_status" },
      { key: "command_status", header: "command_status" },
      { key: "rule_status", header: "rule_status" },
      { key: "billing_status", header: "billing_status" },
      { key: "reason", header: "reason" },
      { key: "notas", header: "notas" }
    ]);

    await db.insert(exportJobs).values({
      propertyId: scope.propertyId,
      type: "audit_csv",
      status: "completed",
      fileName: "voltaria-auditoria.csv",
      metadata: {
        rows: rows.length,
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString()
      },
      completedAt: new Date()
    });

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"voltaria-auditoria.csv\""
      }
    });
  } finally {
    await client.end();
  }
}

function parseRange(url: string, propertyId: string) {
  const searchParams = new URL(url).searchParams;
  const defaultStart = new Date();
  defaultStart.setDate(1);
  defaultStart.setHours(0, 0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setMonth(defaultEnd.getMonth() + 1);
  const parsed = reportsPeriodQuerySchema.safeParse({
    propertyId,
    startDate: searchParams.get("startDate") ?? defaultStart,
    endDate: searchParams.get("endDate") ?? defaultEnd
  });

  if (!parsed.success) {
    return { ok: false as const, error: "Periodo inválido." };
  }

  return {
    ok: true as const,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate
  };
}

function summarizeDetails(details: Record<string, unknown>) {
  const parts = [
    `kWh=${details.recordedKwh ?? "n/a"}`,
    `meter_delta=${details.meterDeltaKwh ?? "n/a"}`,
    `meter_values=${details.meterValues ?? "n/a"}`,
    `max_kw=${details.maxPowerKw ?? "n/a"}`,
    details.stopReason ? `stop_reason=${details.stopReason}` : ""
  ].filter(Boolean);

  return parts.join("; ");
}
