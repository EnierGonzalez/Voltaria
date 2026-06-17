"use client";

import { CalendarDays, FileDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { SectionCard, StatusBadge, cn } from "@voltaria/ui";
import {
  formatCurrency,
  formatDate,
  formatKwh,
  type BillingCycleSummary,
  type ChargingSessionSummary,
  type SessionAuditSummary
} from "@voltaria/shared";
import { createBillingCycleDraftAction } from "@/lib/actions/billing-cycle-actions";
import { EmptyState } from "./empty-state";

export function BillingWorkspace({
  cycles,
  audits,
  sessions,
  basePath = "",
  propertyId
}: {
  cycles: BillingCycleSummary[];
  audits: SessionAuditSummary[];
  sessions: ChargingSessionSummary[];
  basePath?: string;
  propertyId?: string;
}) {
  const router = useRouter();
  const [periodStart, setPeriodStart] = useState(defaultMonthStart());
  const [periodEnd, setPeriodEnd] = useState(defaultMonthEnd());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const stats = useMemo(() => {
    const billableAudits = audits.filter((audit) => audit.billingStatus === "billable");
    const periodSessions = sessions.filter((session) => {
      const startedAt = new Date(session.startedAt);
      return startedAt >= new Date(periodStart) && startedAt < new Date(periodEnd);
    });

    return {
      periodKwh: billableAudits.reduce((sum, audit) => sum + audit.deliveredKwh, 0),
      periodAmount: billableAudits.reduce((sum, audit) => sum + audit.amount, 0),
      sessions: periodSessions.length,
      pendingReview: audits.filter((audit) => audit.auditStatus === "needs_review").length,
      apartments: new Set(billableAudits.map((audit) => audit.apartmentNumber)).size
    };
  }, [audits, periodEnd, periodStart, sessions]);
  const currentCycle = cycles[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-5">
        <BillingKpi label="kWh facturable" value={formatKwh(stats.periodKwh)} />
        <BillingKpi label="Monto estimado" value={formatCurrency(stats.periodAmount)} />
        <BillingKpi label="Sesiones" value={String(stats.sessions)} />
        <BillingKpi label="Revisión" value={String(stats.pendingReview)} warning />
        <BillingKpi label="Deptos" value={String(stats.apartments)} />
      </section>

      <SectionCard
        title="Crear corte"
        description="Genera un draft administrativo por periodo. No crea pagos ni documentos fiscales."
        action={<StatusBadge variant="info">Fuente formal: billing_cycles</StatusBadge>}
      >
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="min-w-0">
            <span className="text-xs uppercase tracking-[0.14em] text-muted">Inicio</span>
            <input
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-border bg-panel2 px-3 text-sm text-foreground outline-none transition focus:border-primary/60"
            />
          </label>
          <label className="min-w-0">
            <span className="text-xs uppercase tracking-[0.14em] text-muted">Fin</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-border bg-panel2 px-3 text-sm text-foreground outline-none transition focus:border-primary/60"
            />
          </label>
          <button
            type="button"
            disabled={isPending}
            onClick={createCycle}
            className="inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-md border border-primary/40 bg-primary/15 px-4 text-sm font-semibold text-cyan transition hover:bg-primary/20 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Crear draft
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
      </SectionCard>

      <SectionCard
        title="Ciclos de corte"
        description={currentCycle ? `Último corte: ${currentCycle.name}` : "Todavía no hay cortes creados."}
        action={
          <div className="flex gap-2">
            <Link
              href="/api/reports/sessions.csv"
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              Sesiones CSV
            </Link>
            <Link
              href={`${basePath}/audit`}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground"
            >
              Auditoría
            </Link>
          </div>
        }
      >
        {cycles.length === 0 ? (
          <EmptyState
            title="Sin cortes"
            description="Crea un draft para revisar consumo por departamento y residente."
            icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <div className="grid gap-3">
            {cycles.map((cycle) => (
              <Link
                key={cycle.id}
                href={`${basePath}/billing/cycles/${cycle.id}`}
                className="grid min-w-0 gap-3 rounded-lg border border-border bg-panel2/58 p-4 transition hover:border-primary/60 md:grid-cols-[minmax(0,1fr)_110px_130px_110px_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{cycle.name}</p>
                  <p className="mt-1 truncate text-sm text-muted">
                    {formatDate(cycle.periodStart.slice(0, 10))} a {formatDate(cycle.periodEnd.slice(0, 10))}
                  </p>
                </div>
                <MetricInline label="Sesiones" value={String(cycle.totalSessions)} />
                <MetricInline label="kWh" value={formatKwh(cycle.totalKwh)} />
                <MetricInline label="Monto" value={formatCurrency(cycle.totalAmount)} />
                <StatusBadge variant={cycleVariant(cycle.status)}>{cycle.statusLabel}</StatusBadge>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );

  function createCycle() {
    setMessage(null);
    startTransition(async () => {
      const result = await createBillingCycleDraftAction({
        periodStart,
        periodEnd,
        ...(propertyId ? { propertyId } : {})
      });

      if (result.ok && result.cycleId) {
        router.push(`${basePath}/billing/cycles/${result.cycleId}`);
        return;
      }

      setMessage(result.error ?? result.message ?? "No se pudo crear el corte.");
    });
  }
}

function BillingKpi({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel p-4">
      <p className="truncate text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={cn("mt-3 truncate text-xl font-semibold", warning ? "text-warning" : "text-foreground")}>
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

function defaultMonthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function defaultMonthEnd() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}
