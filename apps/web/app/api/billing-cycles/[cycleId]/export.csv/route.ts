import { NextResponse } from "next/server";
import {
  createDbClient,
  exportJobs,
  getBillingCycleDetailSummary,
  loadDatabaseEnv
} from "@voltaria/db";
import { recordIdSchema, toCsv } from "@voltaria/shared";

loadDatabaseEnv();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const { cycleId } = await params;
  const parsed = recordIdSchema.safeParse(cycleId);

  if (!parsed.success) {
    return NextResponse.json({ error: "Corte inválido." }, { status: 400 });
  }

  const { db, client } = createDbClient();

  try {
    const detail = await getBillingCycleDetailSummary(db, parsed.data);

    if (!detail) {
      return NextResponse.json({ error: "Corte no encontrado." }, { status: 404 });
    }

    const rows = detail.items.map((item) => ({
      propiedad: detail.cycle.propertyId,
      periodo_inicio: detail.cycle.periodStart,
      periodo_fin: detail.cycle.periodEnd,
      departamento: item.apartmentNumber,
      residente: item.residentName,
      sesiones: item.totalSessions,
      kwh: item.totalKwh.toFixed(3),
      monto: item.totalAmount.toFixed(2),
      ajustes: (item.adjustmentAmount ?? 0).toFixed(2),
      total: item.finalAmount.toFixed(2),
      estado: item.statusLabel
    }));
    const csv = toCsv(rows, [
      { key: "propiedad", header: "propiedad" },
      { key: "periodo_inicio", header: "periodo_inicio" },
      { key: "periodo_fin", header: "periodo_fin" },
      { key: "departamento", header: "departamento" },
      { key: "residente", header: "residente" },
      { key: "sesiones", header: "sesiones" },
      { key: "kwh", header: "kwh" },
      { key: "monto", header: "monto" },
      { key: "ajustes", header: "ajustes" },
      { key: "total", header: "total" },
      { key: "estado", header: "estado" }
    ]);
    const fileName = `voltaria-corte-${detail.cycle.periodStart.slice(0, 10)}-${parsed.data}.csv`;

    await db.insert(exportJobs).values({
      propertyId: detail.cycle.propertyId,
      billingCycleId: detail.cycle.id,
      type: "billing_csv",
      status: "completed",
      fileName,
      metadata: { rows: rows.length },
      completedAt: new Date()
    });

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${fileName}"`
      }
    });
  } finally {
    await client.end();
  }
}
