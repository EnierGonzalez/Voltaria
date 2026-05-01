import { Clock3, CreditCard, PlugZap, UserRound, Zap } from "lucide-react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatKwh,
  formatPower,
  type ChargingSessionSummary,
  type MeterValuePoint,
  type OcppLogSummary,
  type SessionEventSummary
} from "@voltaria/shared";
import { EmptyState } from "./empty-state";
import { MeterValuesChart } from "./meter-values-chart";

export function SessionDetail({
  session,
  events,
  meterValues,
  logs
}: {
  session: ChargingSessionSummary;
  events: SessionEventSummary[];
  meterValues: MeterValuePoint[];
  logs: OcppLogSummary[];
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
          </div>
        </SectionCard>

        <SectionCard title="Meter values" description="Potencia y energía entregada durante la sesión">
          <MeterValuesChart data={meterValues} />
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
