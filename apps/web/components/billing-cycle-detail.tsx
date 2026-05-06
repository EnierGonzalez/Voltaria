"use client";

import { CheckCircle2, FileDown, Lock, RotateCw } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { SectionCard, StatusBadge, cn } from "@voltaria/ui";
import {
  formatCurrency,
  formatDate,
  formatKwh,
  type BillingCycleDetail as BillingCycleDetailData,
  type BillingCycleSummary
} from "@voltaria/shared";
import {
  approveBillingCycleAction,
  closeBillingCycleAction,
  excludeSessionFromCycleAction,
  includeSessionInCycleAction,
  recalculateBillingCycleAction
} from "@/lib/actions/billing-cycle-actions";
import { EmptyState } from "./empty-state";

export function BillingCycleDetail({ detail }: { detail: BillingCycleDetailData }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { cycle, items, sessions } = detail;
  const needsReview = sessions.filter((session) => session.auditStatus !== "valid").length;
  const excluded = sessions.filter((session) => !session.included).length;

  return (
    <div className="space-y-6">
      <SectionCard
        title={cycle.name}
        description={`${formatDate(cycle.periodStart.slice(0, 10))} a ${formatDate(cycle.periodEnd.slice(0, 10))}`}
        action={<StatusBadge variant={cycleVariant(cycle.status)}>{cycle.statusLabel}</StatusBadge>}
      >
        <div className="grid gap-3 md:grid-cols-5">
          <Metric label="kWh" value={formatKwh(cycle.totalKwh)} />
          <Metric label="Monto" value={formatCurrency(cycle.totalAmount)} />
          <Metric label="Sesiones" value={String(cycle.totalSessions)} />
          <Metric label="Warnings" value={String(needsReview)} warning />
          <Metric label="Excluidas" value={String(excluded)} warning={excluded > 0} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending || cycle.status === "closed"}
            onClick={() => runAction(() => recalculateBillingCycleAction(cycle.id))}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground disabled:opacity-60"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Recalcular
          </button>
          <button
            type="button"
            disabled={isPending || cycle.status === "closed"}
            onClick={() => runAction(() => approveBillingCycleAction(cycle.id))}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 text-sm text-success transition hover:bg-success/15 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Aprobar
          </button>
          <button
            type="button"
            disabled={isPending || cycle.status === "closed"}
            onClick={() => runAction(() => closeBillingCycleAction(cycle.id))}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 text-sm text-warning transition hover:bg-warning/15 disabled:opacity-60"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Cerrar
          </button>
          <Link
            href={`/api/billing-cycles/${cycle.id}/export.csv`}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground"
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Exportar CSV
          </Link>
        </div>
        {needsReview > 0 ? (
          <p className="mt-3 rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
            Hay sesiones con revisión pendiente o alerta. El corte puede aprobarse, pero conviene revisar auditoría antes.
          </p>
        ) : null}
        {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
      </SectionCard>

      <SectionCard title="Departamentos y residentes" description="Resumen agrupado del periodo">
        {items.length === 0 ? (
          <EmptyState title="Sin consumo" description="No hay sesiones agrupadas para este corte." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead className="bg-panel2 text-xs uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="w-[18%] px-3 py-3 font-medium">Depto</th>
                  <th className="w-[22%] px-3 py-3 font-medium">Residente</th>
                  <th className="w-[12%] px-3 py-3 font-medium">Sesiones</th>
                  <th className="w-[14%] px-3 py-3 font-medium">kWh</th>
                  <th className="w-[14%] px-3 py-3 font-medium">Monto</th>
                  <th className="w-[10%] px-3 py-3 font-medium">Alertas</th>
                  <th className="w-[10%] px-3 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel/60">
                {items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-panel2/70">
                    <td className="px-3 py-3 font-medium text-foreground">{item.apartmentNumber}</td>
                    <td className="min-w-0 px-3 py-3">
                      <p className="truncate text-foreground">{item.residentName}</p>
                      {item.adjustmentAmount ? (
                        <p className="truncate text-xs text-warning">
                          Ajuste {formatCurrency(item.adjustmentAmount)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-muted">{item.totalSessions}</td>
                    <td className="px-3 py-3 text-foreground">{formatKwh(item.totalKwh)}</td>
                    <td className="px-3 py-3 text-foreground">{formatCurrency(item.finalAmount)}</td>
                    <td className="px-3 py-3 text-muted">{item.warningSessions}</td>
                    <td className="px-3 py-3">
                      <StatusBadge variant={item.status === "adjusted" ? "warning" : "info"}>
                        {item.statusLabel}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Sesiones del corte" description="Trazabilidad de sesiones incluidas y excluidas">
        <div className="grid gap-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="grid min-w-0 gap-3 rounded-lg border border-border bg-panel2/58 p-3 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_auto]"
            >
              <div className="min-w-0">
                <Link
                  href={`/sessions/${session.sessionId}`}
                  className="truncate font-medium text-foreground hover:text-cyan"
                >
                  {session.outletCode} · {session.residentName}
                </Link>
                <p className="truncate text-sm text-muted">Depto {session.apartmentNumber}</p>
              </div>
              <MetricInline label="kWh" value={formatKwh(session.energyDeliveredKwh)} />
              <MetricInline label="Monto" value={formatCurrency(session.amount)} />
              <StatusBadge variant={session.included ? "success" : "critical"}>
                {session.included ? "Incluida" : "Excluida"}
              </StatusBadge>
              <button
                type="button"
                disabled={isPending || cycle.status === "closed"}
                onClick={() =>
                  runAction(() =>
                    session.included
                      ? excludeSessionFromCycleAction({
                          billingCycleId: cycle.id,
                          sessionId: session.sessionId,
                          reason: "Excluida desde detalle de corte"
                        })
                      : includeSessionInCycleAction({
                          billingCycleId: cycle.id,
                          sessionId: session.sessionId
                        })
                  )
                }
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-border bg-panel px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground disabled:opacity-60"
              >
                {session.included ? "Excluir" : "Incluir"}
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );

  function runAction(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? (result.message ?? "Listo.") : (result.error ?? "No se pudo completar."));
    });
  }
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel2/60 p-3">
      <p className="truncate text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={cn("mt-2 truncate text-lg font-semibold", warning ? "text-warning" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function MetricInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function cycleVariant(status: BillingCycleSummary["status"]) {
  if (status === "approved" || status === "exported" || status === "closed") return "success";
  if (status === "reviewing") return "warning";
  return "info";
}
