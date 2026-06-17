"use client";

import { CheckCircle2, FileDown, FileSearch, RotateCw, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { SectionCard, StatusBadge, cn } from "@voltaria/ui";
import {
  formatCurrency,
  formatDateTime,
  formatKwh,
  type AuditBillingStatus,
  type SessionAuditStatus,
  type SessionAuditSummary
} from "@voltaria/shared";
import {
  auditSessionAction,
  excludeSessionFromBillingAction,
  includeSessionInBillingAction,
  markSessionReviewedAction
} from "@/lib/actions/audit-actions";
import { EmptyState } from "./empty-state";

type AuditFilter = "all" | SessionAuditStatus;
type BillingFilter = "all" | AuditBillingStatus;

const auditFilters: Array<{ value: AuditFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "needs_review", label: "Revisión" },
  { value: "warning", label: "Alertas" },
  { value: "failed", label: "Fallidas" },
  { value: "valid", label: "Válidas" }
];

const billingFilters: Array<{ value: BillingFilter; label: string }> = [
  { value: "all", label: "Todo cobro" },
  { value: "billable", label: "Cobrable" },
  { value: "pending_review", label: "Pendiente" },
  { value: "excluded", label: "Excluida" },
  { value: "not_billable", label: "No cobrable" }
];

export function AuditWorkspace({
  audits,
  basePath = ""
}: {
  audits: SessionAuditSummary[];
  basePath?: string;
}) {
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [billingFilter, setBillingFilter] = useState<BillingFilter>("all");
  const [selectedId, setSelectedId] = useState(audits[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      audits.filter((audit) => {
        const matchesAudit = auditFilter === "all" || audit.auditStatus === auditFilter;
        const matchesBilling = billingFilter === "all" || audit.billingStatus === billingFilter;
        return matchesAudit && matchesBilling;
      }),
    [auditFilter, audits, billingFilter]
  );
  const selected = audits.find((audit) => audit.id === selectedId) ?? filtered[0] ?? null;
  const stats = useMemo(
    () => ({
      needsReview: audits.filter((audit) => audit.auditStatus === "needs_review").length,
      warnings: audits.filter((audit) => audit.auditStatus === "warning").length,
      billable: audits.filter((audit) => audit.billingStatus === "billable").length,
      excluded: audits.filter((audit) => audit.billingStatus === "excluded").length
    }),
    [audits]
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <AuditKpi label="Pendientes" value={stats.needsReview} tone="warning" />
        <AuditKpi label="Con alerta" value={stats.warnings} tone="info" />
        <AuditKpi label="Cobrables" value={stats.billable} tone="success" />
        <AuditKpi label="Excluidas" value={stats.excluded} tone="critical" />
      </section>

      <SectionCard
        title="Auditoría operativa"
        description="Conciliación de kWh, comandos, reglas y estatus de cobro."
        action={
          <Link
            href="/api/reports/audit.csv"
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm font-medium text-muted transition hover:border-primary/60 hover:text-foreground"
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            CSV
          </Link>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {auditFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setAuditFilter(filter.value)}
              className={filterButtonClass(auditFilter === filter.value)}
            >
              {filter.label}
            </button>
          ))}
          {billingFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setBillingFilter(filter.value)}
              className={filterButtonClass(billingFilter === filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Sin sesiones para revisar"
            description="No hay auditorías que coincidan con los filtros actuales."
            icon={<FileSearch className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border border-border md:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <thead className="bg-panel2 text-xs uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="w-[18%] px-3 py-3 font-medium">Fecha</th>
                    <th className="w-[20%] px-3 py-3 font-medium">Sesión</th>
                    <th className="w-[18%] px-3 py-3 font-medium">Residente</th>
                    <th className="w-[10%] px-3 py-3 font-medium">kWh</th>
                    <th className="w-[14%] px-3 py-3 font-medium">Auditoría</th>
                    <th className="w-[14%] px-3 py-3 font-medium">Cobro</th>
                    <th className="w-[6%] px-3 py-3 font-medium">Ver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-panel/60">
                  {filtered.map((audit) => (
                    <tr
                      key={audit.id}
                      className={cn(
                        "cursor-pointer transition hover:bg-panel2/70",
                        selected?.id === audit.id && "bg-primary/10"
                      )}
                      onClick={() => setSelectedId(audit.id)}
                    >
                      <td className="px-3 py-3 text-muted">{formatDateTime(audit.sessionStartedAt)}</td>
                      <td className="min-w-0 px-3 py-3">
                        <Link
                          href={`${basePath}/sessions/${audit.sessionId}`}
                          className="block truncate font-medium text-foreground hover:text-cyan"
                        >
                          {audit.outletCode}
                        </Link>
                        <p className="truncate text-xs text-muted">{audit.sessionId}</p>
                      </td>
                      <td className="min-w-0 px-3 py-3">
                        <p className="truncate text-foreground">{audit.residentName}</p>
                        <p className="truncate text-xs text-muted">Depto {audit.apartmentNumber}</p>
                      </td>
                      <td className="px-3 py-3 text-foreground">{formatKwh(audit.deliveredKwh)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge variant={statusVariant(audit.auditStatus)}>
                          {audit.auditStatusLabel}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge variant={billingVariant(audit.billingStatus)}>
                          {audit.billingStatusLabel}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {filtered.map((audit) => (
                <button
                  key={audit.id}
                  type="button"
                  onClick={() => setSelectedId(audit.id)}
                  className="min-w-0 rounded-lg border border-border bg-panel2/60 p-3 text-left transition hover:border-primary/60"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{audit.residentName}</p>
                      <p className="truncate text-sm text-muted">
                        Depto {audit.apartmentNumber} · {audit.outletCode}
                      </p>
                    </div>
                    <StatusBadge variant={statusVariant(audit.auditStatus)}>
                      {audit.auditStatusLabel}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {formatKwh(audit.deliveredKwh)} · {formatCurrency(audit.amount)}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {selected ? (
        <SectionCard
          title="Detalle de revisión"
          description={`${selected.residentName} · Depto ${selected.apartmentNumber} · ${selected.outletCode}`}
          action={<StatusBadge variant={billingVariant(selected.billingStatus)}>{selected.billingStatusLabel}</StatusBadge>}
        >
          <div className="grid gap-3 md:grid-cols-4">
            <DetailMetric label="Energía" value={formatKwh(selected.deliveredKwh)} />
            <DetailMetric label="Costo" value={formatCurrency(selected.amount)} />
            <DetailMetric label="Medición" value={selected.energyStatusLabel} />
            <DetailMetric label="Comandos" value={selected.commandStatusLabel} />
          </div>
          <div className="mt-4 rounded-lg border border-border bg-panel2/60 p-4 text-sm text-muted">
            <p className="font-medium text-foreground">Trazabilidad</p>
            <p className="mt-2">
              Regla: {selected.ruleStatusLabel}. Meter values: {String(selected.details.meterValues ?? "n/a")}.
              Max kW: {String(selected.details.maxPowerKw ?? "n/a")}. Stop reason:{" "}
              {String(selected.details.stopReason ?? "n/a")}.
            </p>
            {selected.notes ? <p className="mt-2 text-warning">Nota: {selected.notes}</p> : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => runAction(() => auditSessionAction(selected.sessionId))}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground disabled:opacity-60"
            >
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              Re-auditar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(() => markSessionReviewedAction({ sessionId: selected.sessionId }))
              }
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 text-sm text-success transition hover:bg-success/15 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Marcar revisada
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(() =>
                  excludeSessionFromBillingAction({
                    sessionId: selected.sessionId,
                    reason: "Excluida desde auditoría operativa"
                  })
                )
              }
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 text-sm text-danger transition hover:bg-danger/15 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Excluir
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(() =>
                  includeSessionInBillingAction({
                    sessionId: selected.sessionId,
                    reason: "Incluida manualmente desde auditoría"
                  })
                )
              }
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 text-sm text-cyan transition hover:bg-primary/15 disabled:opacity-60"
            >
              Incluir en cobro
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
        </SectionCard>
      ) : null}
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

function AuditKpi({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "critical" | "info";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel p-4">
      <p className="truncate text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={cn("mt-3 text-2xl font-semibold", toneClass(tone))}>{value}</p>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel2/60 p-3">
      <p className="truncate text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function filterButtonClass(active: boolean) {
  return cn(
    "min-h-9 rounded-md border border-border bg-panel2 px-3 text-sm font-medium text-muted transition hover:text-foreground",
    active && "border-primary/40 bg-primary/15 text-cyan"
  );
}

function statusVariant(status: SessionAuditStatus) {
  if (status === "valid") return "success";
  if (status === "warning" || status === "needs_review") return "warning";
  return "critical";
}

function billingVariant(status: AuditBillingStatus) {
  if (status === "billable") return "success";
  if (status === "pending_review") return "warning";
  if (status === "excluded") return "critical";
  return "info";
}

function toneClass(tone: "success" | "warning" | "critical" | "info") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "critical") return "text-danger";
  return "text-cyan";
}
