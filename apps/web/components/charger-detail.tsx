"use client";

import { AlertTriangle, Power, ScrollText, Zap } from "lucide-react";
import { useState } from "react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatKwh,
  formatPower,
  type ChargerSummary,
  type ChargingSessionSummary,
  type OcppLogSummary
} from "@voltaria/shared";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyState } from "./empty-state";
import { SessionTable } from "./session-table";

export function ChargerDetail({
  charger,
  currentSession,
  sessions,
  logs
}: {
  charger: ChargerSummary;
  currentSession?: ChargingSessionSummary;
  sessions: ChargingSessionSummary[];
  logs: OcppLogSummary[];
}) {
  const [stopped, setStopped] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canStop = charger.status === "charging" && currentSession && !stopped;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Estado"
          value={stopped ? "Detenida" : charger.statusLabel}
          delta={charger.code}
          tone={charger.status === "faulted" ? "danger" : charger.status === "charging" ? "success" : "cyan"}
          icon={<Zap className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Ubicación"
          value={charger.location}
          delta="Torre Aurora"
          tone="primary"
          icon={<Power className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Conectores"
          value={charger.connectors.toString()}
          delta={`${formatPower(charger.maxPowerKw)} máximo`}
          tone="cyan"
          icon={<Power className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Última comunicación"
          value={formatDateTime(charger.lastSeenAt)}
          delta={`OCPP ${charger.ocppVersion}`}
          tone="success"
          icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      {charger.status === "faulted" ? (
        <div className="rounded-lg border border-danger/45 bg-danger/10 p-4 text-danger">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium">Cargador en falla</p>
              <p className="mt-1 text-sm text-danger/90">
                El último evento OCPP reportó un estado faulted. Revisa logs antes de habilitarlo.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <SectionCard
        title="Sesión actual"
        description="Datos de sesión del cargador seleccionado"
        action={
          canStop ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="min-h-9 rounded-md border border-danger/40 bg-danger/12 px-3 text-sm font-semibold text-danger transition hover:bg-danger/20"
            >
              Detener carga
            </button>
          ) : currentSession ? (
            <StatusBadge variant="interrupted">Detenida</StatusBadge>
          ) : undefined
        }
      >
        {currentSession ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Residente" value={currentSession.residentName} />
            <Metric label="Departamento" value={currentSession.apartmentNumber} />
            <Metric label="Energía" value={formatKwh(currentSession.deliveredKwh)} />
            <Metric label="Tiempo" value={formatDuration(currentSession.durationMinutes)} />
            <Metric label="Potencia" value={formatPower(stopped ? 0 : currentSession.powerKw)} />
            <Metric label="Costo" value={formatCurrency(currentSession.costAmount)} />
            <Metric label="Tarifa" value={`${formatCurrency(currentSession.ratePerKwh)} / kWh`} />
            <Metric label="Conector" value={currentSession.connectorNumber.toString()} />
          </div>
        ) : (
          <EmptyState title="Sin sesión activa" description="Este cargador no tiene una sesión activa en los datos mock." />
        )}
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title="Últimos mensajes OCPP" description="Mensajes crudos resumidos para auditoría">
          <OcppLogList logs={logs} />
        </SectionCard>

        <SectionCard title="Historial reciente" description="Sesiones asociadas a este cargador">
          <SessionTable sessions={sessions} />
        </SectionCard>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Detener carga"
        description="Esta acción es mock por ahora. La UI marcará la sesión como detenida sin persistir cambios."
        confirmLabel="Detener"
        onConfirm={() => {
          setStopped(true);
          setConfirmOpen(false);
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function OcppLogList({ logs }: { logs: OcppLogSummary[] }) {
  if (logs.length === 0) {
    return <EmptyState title="Sin logs" description="No hay mensajes OCPP mock para este cargador." />;
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="min-w-0 rounded-lg border border-border bg-panel2/58 p-3">
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
