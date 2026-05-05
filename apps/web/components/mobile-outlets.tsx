"use client";

import { KeyRound, PlugZap, StopCircle, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { SectionCard, StatusBadge } from "@voltaria/ui";
import {
  formatCurrency,
  formatKwh,
  formatPower,
  mobileResident,
  startOutletSession,
  type ChargingSessionSummary,
  type ControlledOutletSummary,
  type ResidentSummary,
  type TariffSummary
} from "@voltaria/shared";
import { MobileMetricCard } from "./mobile-metric-card";

type OutletsData = {
  outlets: ControlledOutletSummary[];
  sessions: ChargingSessionSummary[];
  residents: ResidentSummary[];
  tariffs: TariffSummary[];
};

export function MobileOutletsScreen({ data }: { data: OutletsData }) {
  const available = data.outlets.filter((outlet) => outlet.status === "available").length;
  const active = data.outlets.filter((outlet) => outlet.status === "charging").length;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Tomas"
        description="Selecciona la toma 120V donde conectaste tu carrito."
        action={<StatusBadge variant="success">{available} disponibles</StatusBadge>}
      >
        <div className="grid grid-cols-2 gap-3">
          <MobileMetricCard label="Disponibles" value={available.toString()} />
          <MobileMetricCard label="Activas" value={active.toString()} />
        </div>
      </SectionCard>

      <div className="space-y-3">
        {data.outlets.map((outlet) => (
          <a
            key={outlet.id}
            href={`/mobile/outlets/${outlet.publicAccessCode}`}
            className="block min-w-0 overflow-hidden rounded-lg border border-border bg-panel/86 p-4 transition hover:border-cyan/50 hover:bg-panel2"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{outlet.name}</p>
                <p className="mt-1 truncate text-sm text-muted">{outlet.location}</p>
              </div>
              <StatusBadge variant={outlet.status}>{outlet.statusLabel}</StatusBadge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Mini label="Potencia" value={formatPower(outlet.currentPowerKw)} />
              <Mini label="Sesión" value={formatKwh(outlet.currentSessionKwh)} />
              <Mini label="Límite" value={`${outlet.maxCurrentAmp} A`} />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export function MobileOutletDetailScreen({
  data,
  outlet
}: {
  data: OutletsData;
  outlet: ControlledOutletSummary;
}) {
  const resident = data.residents.find((item) => item.id === mobileResident.id) ?? mobileResident;
  const tariff = data.tariffs[0];
  const activeSessions = data.sessions.filter(
    (session) => session.status === "active" || session.status === "pending_start"
  );
  const existingSession = activeSessions.find((session) => session.residentName === resident.name);
  const [localSession, setLocalSession] = useState<ChargingSessionSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);

  const displayedSession = stopped ? null : localSession ?? existingSession ?? null;
  const canStart = !displayedSession && outlet.status === "available";
  const meterPreview = useMemo(() => {
    const power = displayedSession ? displayedSession.powerKw : outlet.currentPowerKw;
    return {
      power,
      kwh: displayedSession?.deliveredKwh ?? outlet.currentSessionKwh,
      cost: (displayedSession?.deliveredKwh ?? outlet.currentSessionKwh) * (tariff?.ratePerKwh ?? 0)
    };
  }, [displayedSession, outlet.currentPowerKw, outlet.currentSessionKwh, tariff?.ratePerKwh]);

  return (
    <div className="space-y-5">
      <SectionCard
        title={outlet.name}
        description={outlet.location}
        action={<StatusBadge variant={displayedSession ? "active" : outlet.status}>{displayedSession ? "Activa" : outlet.statusLabel}</StatusBadge>}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-cyan/30 bg-panel2 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-cyan">
                <PlugZap className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted">Código de toma física</p>
                <p className="truncate font-semibold text-foreground">{outlet.code}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MobileMetricCard label="Voltaje" value={`${outlet.voltage} V`} />
            <MobileMetricCard label="Límite" value={`${outlet.maxCurrentAmp} A`} />
            <MobileMetricCard label="Potencia actual" value={formatPower(meterPreview.power)} />
            <MobileMetricCard label="kWh sesión" value={formatKwh(meterPreview.kwh)} />
            <MobileMetricCard label="Tarifa" value={`${formatCurrency(tariff?.ratePerKwh ?? 0)} / kWh`} className="col-span-2" />
          </div>

          {displayedSession ? (
            <button
              type="button"
              onClick={() => {
                setStopped(true);
                setLocalSession(null);
                setMessage("Sesión detenida en simulador. El comando disable quedó registrado de forma mock.");
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-danger/40 bg-danger/12 px-4 text-sm font-semibold text-danger transition hover:bg-danger/20"
            >
              <StopCircle className="h-4 w-4" aria-hidden="true" />
              Detener carga
            </button>
          ) : (
            <button
              type="button"
              disabled={!canStart}
              onClick={() => {
                const result = startOutletSession({
                  outlet,
                  resident,
                  activeSessions,
                  ...(tariff ? { tariff } : {}),
                  method: "mobile"
                });

                if (!result.ok) {
                  setMessage(result.reason);
                  return;
                }

                setLocalSession(result.session);
                setMessage("Comando enable simulado y sesión activa. Si no hay consumo en 90 segundos se cancelará.");
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-success/40 bg-success/12 px-4 text-sm font-semibold text-success transition hover:bg-success/20 disabled:cursor-not-allowed disabled:border-muted/20 disabled:bg-muted/10 disabled:text-muted"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              Iniciar carga
            </button>
          )}

          {message ? (
            <div className="rounded-md border border-border bg-panel/70 p-3 text-sm leading-6 text-muted">
              {message}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Autorización" description="RFID o app móvil">
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-panel2/64 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-success">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="min-w-0 text-sm leading-6 text-muted">
            También puedes iniciar una sesión pasando tu tarjeta RFID física por el lector asociado a la toma.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-panel2/64 p-2">
      <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
