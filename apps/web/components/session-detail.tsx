import { Clock3, CreditCard, FileSearch, PlugZap, RadioTower, ShieldCheck, UserRound, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import {
  type AuthorizationAttemptSummary,
  type DeviceCommandSummary,
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatKwh,
  formatPower,
  type ChargingSessionSummary,
  type MeterValuePoint,
  type OcppLogSummary,
  type RuleEvaluationSummary,
  type SessionAuditSummary,
  type SessionEventSummary
} from "@voltaria/shared";
import { EmptyState } from "./empty-state";
import { MeterValuesChart } from "./meter-values-chart";

export function SessionDetail({
  session,
  events,
  meterValues,
  logs,
  commands,
  ruleEvaluations,
  authorizationAttempts,
  audit
}: {
  session: ChargingSessionSummary;
  events: SessionEventSummary[];
  meterValues: MeterValuePoint[];
  logs: OcppLogSummary[];
  commands: DeviceCommandSummary[];
  ruleEvaluations: RuleEvaluationSummary[];
  authorizationAttempts: AuthorizationAttemptSummary[];
  audit: SessionAuditSummary | null;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Residente"
          value={session.residentName}
          delta={`Depto ${session.apartmentNumber}`}
          tone="primary"
          icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Cargador"
          value={session.chargerCode}
          delta={session.chargerLocation}
          tone="cyan"
          icon={<PlugZap className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Energía entregada"
          value={formatKwh(session.deliveredKwh)}
          delta={formatDuration(session.durationMinutes)}
          tone="success"
          icon={<Zap className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Costo estimado"
          value={formatCurrency(session.costAmount)}
          delta={session.tariffName}
          tone="warning"
          icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <SectionCard
          title="Detalle de sesión"
          description={`${formatDateTime(session.startedAt)} · ${session.endedAt ? formatDateTime(session.endedAt) : "En curso"}`}
          action={<StatusBadge variant={session.status}>{session.statusLabel}</StatusBadge>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Inicio" value={formatDateTime(session.startedAt)} />
            <Metric label="Fin" value={session.endedAt ? formatDateTime(session.endedAt) : "En curso"} />
            <Metric label="Duración" value={formatDuration(session.durationMinutes)} />
            <Metric label="Potencia" value={formatPower(session.powerKw)} />
            <Metric label="Tarifa aplicada" value={`${formatCurrency(session.ratePerKwh)} / kWh`} />
            <Metric label="Conector" value={session.connectorNumber.toString()} />
            <Metric label="Método" value={session.activationMethodLabel ?? "Manual"} />
            <Metric label="Motivo de paro" value={session.stopReason ?? "N/A"} />
          </div>
        </SectionCard>

        <SectionCard title="Meter values" description="Potencia y energía entregada durante la sesión">
          <MeterValuesChart data={meterValues} />
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <SectionCard
          title="Auditoría"
          description="Resultado de conciliación operativa y cobro interno"
          action={
            audit ? (
              <StatusBadge variant={audit.auditStatus === "valid" ? "success" : audit.auditStatus === "failed" ? "critical" : "warning"}>
                {audit.auditStatusLabel}
              </StatusBadge>
            ) : (
              <StatusBadge variant="info">Sin auditar</StatusBadge>
            )
          }
        >
          {audit ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Medición" value={audit.energyStatusLabel} />
                <Metric label="Comandos" value={audit.commandStatusLabel} />
                <Metric label="Reglas" value={audit.ruleStatusLabel} />
                <Metric label="Cobro" value={audit.billingStatusLabel} />
              </div>
              <div className="rounded-lg border border-border bg-panel2/58 p-3 text-sm text-muted">
                <p className="font-medium text-foreground">Resumen defendible</p>
                <p className="mt-2">
                  kWh registrados: {String(audit.details.recordedKwh ?? "n/a")}. Delta medidor:{" "}
                  {String(audit.details.meterDeltaKwh ?? "n/a")}. Meter values:{" "}
                  {String(audit.details.meterValues ?? "n/a")}. Max kW:{" "}
                  {String(audit.details.maxPowerKw ?? "n/a")}.
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Sin auditoría"
              description="La sesión aparecerá aquí al correr auditoría del periodo o crear un corte."
              icon={<FileSearch className="h-6 w-6" aria-hidden="true" />}
            />
          )}
        </SectionCard>

        <SectionCard title="Comandos y reglas" description="Device commands y evaluaciones relacionadas">
          <div className="grid gap-3 lg:grid-cols-2">
            <TraceList
              title="Comandos"
              icon={<Zap className="h-4 w-4" aria-hidden="true" />}
              items={commands.map((command) => ({
                id: command.id,
                title: command.commandType,
                subtitle: command.requestedBy ?? "runtime",
                badge: command.status,
                date: command.createdAt
              }))}
            />
            <TraceList
              title="Reglas"
              icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              items={ruleEvaluations.map((rule) => ({
                id: rule.id,
                title: rule.reason,
                subtitle: rule.method,
                badge: rule.result,
                date: rule.createdAt
              }))}
            />
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Timeline" description="Eventos relevantes de la sesión">
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex gap-3 rounded-lg border border-border bg-panel2/58 p-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-cyan">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{event.label}</p>
                      <StatusBadge variant={event.tone}>{event.tone}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-muted">{event.description}</p>
                    <p className="mt-2 text-xs text-muted">{formatDateTime(event.occurredAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin eventos" description="No hay timeline mock para esta sesión." />
          )}
        </SectionCard>

        <SectionCard title="RFID / Autorización" description="Intentos asociados sin exponer idTag completo">
          {authorizationAttempts.length > 0 ? (
            <div className="space-y-3">
              {authorizationAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-lg border border-border bg-panel2/58 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{attempt.method}</p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {attempt.reason ?? "Sin motivo"} · {attempt.maskedValue ?? "Sin tarjeta"}
                      </p>
                    </div>
                    <StatusBadge variant={attempt.result === "accepted" ? "success" : "warning"}>
                      {attempt.result}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-muted">{formatDateTime(attempt.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sin intentos"
              description="No hay autorización RFID/móvil asociada a esta sesión."
              icon={<RadioTower className="h-6 w-6" aria-hidden="true" />}
            />
          )}
        </SectionCard>
      </section>

      <section>
        <SectionCard title="Mensajes OCPP" description="Mensajes relacionados con la sesión">
          {logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border bg-panel2/58 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{log.action}</p>
                      <p className="mt-1 truncate text-xs text-muted">{log.payloadSummary}</p>
                    </div>
                    <StatusBadge variant={log.direction === "inbound" ? "info" : "success"}>
                      {log.direction}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-muted">{formatDateTime(log.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin mensajes" description="No hay mensajes OCPP mock para esta sesión." />
          )}
        </SectionCard>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel2/58 p-3">
      <p className="truncate text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TraceList({
  title,
  icon,
  items
}: {
  title: string;
  icon: ReactNode;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    badge: string;
    date: string;
  }>;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel2/58 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="text-cyan">{icon}</span>
        {title}
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-panel/70 p-2">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{item.title}</p>
                  <p className="truncate text-xs text-muted">{item.subtitle}</p>
                </div>
                <StatusBadge variant={traceVariant(item.badge)}>{item.badge}</StatusBadge>
              </div>
              <p className="mt-2 text-xs text-muted">{formatDateTime(item.date)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Sin registros.</p>
      )}
    </div>
  );
}

function traceVariant(value: string) {
  if (value === "allowed" || value === "acknowledged" || value === "accepted") return "success";
  if (value === "denied" || value === "failed" || value === "timeout") return "critical";
  if (value === "pending" || value === "sent") return "warning";
  return "info";
}
