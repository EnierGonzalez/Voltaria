import { NextResponse } from "next/server";
import {
  auditSessionsForPeriod,
  createDbClient,
  exportJobs,
  getRecentSessions,
  loadDatabaseEnv
} from "@voltaria/db";
import { normalizeDateRange, reportsPeriodQuerySchema, startOfMonthUtc, toCsv } from "@voltaria/shared";
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

    const sessions = (await getRecentSessions(db, scope.propertyId, 1000)).filter((session) => {
      const startedAt = new Date(session.startedAt);
      return startedAt >= range.startDate && startedAt < range.endDate;
    });
    const rows = sessions.map((session) => ({
      session_id: session.id,
      fecha_inicio: session.startedAt,
      fecha_fin: session.endedAt ?? "",
      residente: session.residentName,
      departamento: session.apartmentNumber,
      toma: session.chargerCode,
      activation_method: session.activationMethod ?? "",
      kwh: session.deliveredKwh.toFixed(3),
      costo: session.costAmount.toFixed(2),
      estado: session.status,
      audit_status: session.auditStatus ?? "",
      billing_status: session.billingStatus ?? ""
    }));
    const csv = toCsv(rows, [
      { key: "session_id", header: "session_id" },
      { key: "fecha_inicio", header: "fecha_inicio" },
      { key: "fecha_fin", header: "fecha_fin" },
      { key: "residente", header: "residente" },
      { key: "departamento", header: "departamento" },
      { key: "toma", header: "toma" },
      { key: "activation_method", header: "activation_method" },
      { key: "kwh", header: "kwh" },
      { key: "costo", header: "costo" },
      { key: "estado", header: "estado" },
      { key: "audit_status", header: "audit_status" },
      { key: "billing_status", header: "billing_status" }
    ]);

    await db.insert(exportJobs).values({
      propertyId: scope.propertyId,
      type: "sessions_csv",
      status: "completed",
      fileName: "voltaria-sesiones.csv",
      metadata: { rows: rows.length, startDate: range.startDate.toISOString(), endDate: range.endDate.toISOString() },
      completedAt: new Date()
    });

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"voltaria-sesiones.csv\""
      }
    });
  } finally {
    await client.end();
  }
}

function parseRange(url: string, propertyId: string) {
  const searchParams = new URL(url).searchParams;
  const defaultStart = startOfMonthUtc(new Date());
  const defaultEnd = new Date(Date.UTC(defaultStart.getUTCFullYear(), defaultStart.getUTCMonth() + 1, 1));
  const parsed = reportsPeriodQuerySchema.safeParse({
    propertyId,
    startDate: searchParams.get("startDate") ?? defaultStart,
    endDate: searchParams.get("endDate") ?? defaultEnd
  });

  if (!parsed.success) {
    return { ok: false as const, error: "Periodo inválido." };
  }

  const { startDate, endDate } = normalizeDateRange(parsed.data);

  return {
    ok: true as const,
    startDate,
    endDate
  };
}
