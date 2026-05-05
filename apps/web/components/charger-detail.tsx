"use client";

import { AlertTriangle, Power, ScrollText, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatKwh,
  formatPower,
  type ChargerSummary,
  type ChargingSessionSummary,
  type DeviceCommandSummary,
  type OcppLogSummary,
  type OutletAccessRuleSummary
} from "@voltaria/shared";
import { adminStopOutletSession } from "@/lib/actions/outlet-actions";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyState } from "./empty-state";
import { SessionTable } from "./session-table";

export function ChargerDetail({
  charger,
  currentSession,
  sessions,
  logs,
  commands,
  outletRule
}: {
  charger: ChargerSummary;
  currentSession?: ChargingSessionSummary;
  sessions: ChargingSessionSummary[];
  logs: OcppLogSummary[];
  commands: DeviceCommandSummary[];
  outletRule?: OutletAccessRuleSummary | null;
}) {
  const [stopRequested, setStopRequested] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const canStop = charger.status === "charging" && currentSession && !stopRequested;
  const isOutlet = charger.kind === "controlled_outlet";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Estado"
          value={stopRequested ? "Apagado solicitado" : charger.statusLabel}
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
          value={isOutlet ? `${charger.voltage ?? 120} V` : charger.connectors.toString()}
          delta={isOutlet ? `${charger.maxCurrentAmp ?? 12} A máximo` : `${formatPower(charger.maxPowerKw)} máximo`}
          tone="cyan"
          icon={<Power className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Última comunicación"
          value={formatDateTime(charger.lastSeenAt)}
          delta={isOutlet ? `Control ${charger.controlMode ?? "simulated"}` : `OCPP ${charger.ocppVersion}`}
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
                El último evento operativo reportó una falla. Revisa logs antes de habilitarlo.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <SectionCard
        title="Sesión actual"
        description={`Datos de sesión ${isOutlet ? "de la toma seleccionada" : "del cargador seleccionado"}`}
        action={
          canStop ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
              className="min-h-9 rounded-md border border-danger/40 bg-danger/12 px-3 text-sm font-semibold text-danger transition hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Enviando..." : "Detener carga"}
            </button>
          ) : stopRequested ? (
            <StatusBadge variant="pending">Apagado pendiente</StatusBadge>
          ) : undefined
        }
      >
        {currentSession ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Residente" value={currentSession.residentName} />
            <Metric label="Departamento" value={currentSession.apartmentNumber} />
            <Metric label="Energía" value={formatKwh(currentSession.deliveredKwh)} />
            <Metric label="Tiempo" value={formatDuration(currentSession.durationMinutes)} />
            <Metric label="Potencia" value={formatPower(currentSession.powerKw)} />
            <Metric label="Costo" value={formatCurrency(currentSession.costAmount)} />
            <Metric label="Tarifa" value={`${formatCurrency(currentSession.ratePerKwh)} / kWh`} />
            <Metric label={isOutlet ? "Toma" : "Conector"} value={isOutlet ? charger.code : currentSession.connectorNumber.toString()} />
          </div>
        ) : (
          <EmptyState title="Sin sesión activa" description="Este punto de carga no tiene una sesión activa." />
        )}
        {message ? (
          <div className="mt-4 rounded-md border border-border bg-panel/70 p-3 text-sm leading-6 text-muted">
            {message}
          </div>
        ) : null}
      </SectionCard>

      {isOutlet ? (
        <SectionCard title="Reglas aplicadas" description="Estado operativo y límites efectivos de esta toma">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Estado operativo" value={outletRule?.statusLabel ?? "Disponible"} />
            <Metric label="RFID" value={outletRule?.allowRfid === false ? "No permitido" : "Permitido"} />
            <Metric label="Móvil" value={outletRule?.allowMobile === false ? "No permitido" : "Permitido"} />
            <Metric label="Corriente máx." value={`${outletRule?.maxCurrentAmp ?? charger.maxCurrentAmp ?? 12} A`} />
            <Metric
              label="Duración máx."
              value={
                outletRule?.maxSessionDurationMinutes
                  ? formatDuration(outletRule.maxSessionDurationMinutes)
                  : "Regla global"
              }
            />
            <Metric label="Notas" value={outletRule?.notes ?? "Sin override"} />
          </div>
        </SectionCard>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title={isOutlet ? "Últimos comandos" : "Últimos mensajes OCPP"} description={isOutlet ? "Historial de enable/disable del simulador" : "Mensajes crudos resumidos para auditoría"}>
          {isOutlet ? <CommandHistory commands={commands} /> : <OcppLogList logs={logs} />}
        </SectionCard>

        <SectionCard title="Historial reciente" description="Sesiones asociadas a este punto">
          <SessionTable sessions={sessions} />
        </SectionCard>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Detener carga"
        description="Se creará un comando disable. El simulador cerrará la sesión cuando confirme el apagado."
        confirmLabel="Detener"
        onConfirm={() => {
          if (!currentSession) {
            setConfirmOpen(false);
            return;
          }

          startTransition(() => {
            void (async () => {
              const result = await adminStopOutletSession(currentSession.id);
              setMessage(result.ok ? result.message : result.error);
              setStopRequested(result.ok);
              setConfirmOpen(false);
              router.refresh();
            })();
          });
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function CommandHistory({ commands }: { commands: DeviceCommandSummary[] }) {
  if (commands.length === 0) {
    return <EmptyState title="Sin comandos" description="Todavía no hay comandos registrados para esta toma." />;
  }

  return (
    <div className="space-y-3">
      {commands.map((command) => (
        <div key={command.id} className="min-w-0 rounded-lg border border-border bg-panel2/58 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{command.commandType}</p>
              <p className="mt-1 truncate text-xs text-muted">
                {command.requestedBy ?? "system"} · {formatDateTime(command.createdAt)}
              </p>
            </div>
            <StatusBadge variant={commandStatusVariant(command.status)}>{command.status}</StatusBadge>
          </div>
          {command.acknowledgedAt ? (
            <p className="mt-2 text-xs text-muted">ACK {formatDateTime(command.acknowledgedAt)}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function commandStatusVariant(status: DeviceCommandSummary["status"]) {
  if (status === "acknowledged") {
    return "acknowledged";
  }

  if (status === "failed" || status === "timeout") {
    return "failed";
  }

  return "pending";
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
