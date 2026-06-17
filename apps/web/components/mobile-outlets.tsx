"use client";

import { KeyRound, PlugZap, StopCircle, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { SectionCard, StatusBadge } from "@voltaria/ui";
import {
  formatCurrency,
  formatKwh,
  formatPower,
  mobileResident,
  type ChargingSessionSummary,
  type ControlledOutletSummary,
  type ResidentSummary,
  type TariffSummary
} from "@voltaria/shared";
import {
  startMobileOutletSession,
  stopMobileOutletSession
} from "@/lib/actions/outlet-actions";
import { MobileMetricCard } from "./mobile-metric-card";

type OutletsData = {
  outlets: ControlledOutletSummary[];
  sessions: ChargingSessionSummary[];
  residents: ResidentSummary[];
  tariffs: TariffSummary[];
  currentResident?: {
    id: string;
    name: string;
  };
};

export function MobileOutletsScreen({ data }: { data: OutletsData }) {
  const available = data.outlets.filter((outlet) => (outlet.operationalStatus ?? outlet.status) === "available").length;
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
              <StatusBadge variant={outletStatusVariant(outlet)}>
                {outlet.operationalStatusLabel ?? outlet.statusLabel}
              </StatusBadge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Mini label="Potencia" value={formatPower(outlet.currentPowerKw)} />
              <Mini label="Sesión" value={formatKwh(outlet.currentSessionKwh)} />
              <Mini label="Límite" value={`${outlet.appliedMaxCurrentAmp ?? outlet.maxCurrentAmp} A`} />
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
  const resident = data.currentResident ?? mobileResident;
  const tariff = data.tariffs[0];
  const activeSessions = data.sessions.filter(
    (session) => session.status === "active" || session.status === "pending_start"
  );
  const existingSession = activeSessions.find((session) => session.residentName === resident.name);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const displayedSession = existingSession ?? null;
  const isCurrentOutletSession = displayedSession?.chargerId === outlet.id;
  const canStart = !displayedSession && (outlet.operationalStatus ?? outlet.status) === "available";
  const meterPreview = useMemo(() => {
    const power = displayedSession ? displayedSession.powerKw : outlet.currentPowerKw;
    return {
      power,
      kwh: displayedSession?.deliveredKwh ?? outlet.currentSessionKwh,
      cost: (displayedSession?.deliveredKwh ?? outlet.currentSessionKwh) * (tariff?.ratePerKwh ?? 0)
    };
  }, [displayedSession, outlet.currentPowerKw, outlet.currentSessionKwh, tariff?.ratePerKwh]);
  const status = getOutletRuntimeStatus(outlet, displayedSession, isCurrentOutletSession);

  return (
    <div className="space-y-5">
      <SectionCard
        title={outlet.name}
        description={outlet.location}
        action={<StatusBadge variant={status.variant}>{status.label}</StatusBadge>}
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
            <MobileMetricCard label="Límite" value={`${outlet.appliedMaxCurrentAmp ?? outlet.maxCurrentAmp} A`} />
            <MobileMetricCard label="Potencia actual" value={formatPower(meterPreview.power)} />
            <MobileMetricCard label="kWh sesión" value={formatKwh(meterPreview.kwh)} />
            <MobileMetricCard label="Tarifa" value={`${formatCurrency(tariff?.ratePerKwh ?? 0)} / kWh`} className="col-span-2" />
          </div>

          {displayedSession && isCurrentOutletSession ? (
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  void (async () => {
                    const result = await stopMobileOutletSession(displayedSession.id);
                    setMessage(result.ok ? result.message : result.error);
                    router.refresh();
                  })();
                });
              }}
              disabled={isPending}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-danger/40 bg-danger/12 px-4 text-sm font-semibold text-danger transition hover:bg-danger/20"
            >
              <StopCircle className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Enviando comando..." : "Detener carga"}
            </button>
          ) : displayedSession ? (
            <a
              href="/mobile/charge"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-cyan/40 bg-cyan/12 px-4 text-sm font-semibold text-cyan transition hover:bg-cyan/20"
            >
              Ver sesión activa
            </a>
          ) : (
            <button
              type="button"
              disabled={!canStart || isPending}
              onClick={() => {
                startTransition(() => {
                  void (async () => {
                    const result = await startMobileOutletSession(outlet.publicAccessCode);
                    setMessage(result.ok ? result.message : result.error);
                    router.refresh();
                  })();
                });
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-success/40 bg-success/12 px-4 text-sm font-semibold text-success transition hover:bg-success/20 disabled:cursor-not-allowed disabled:border-muted/20 disabled:bg-muted/10 disabled:text-muted"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Iniciando..." : "Iniciar carga"}
            </button>
          )}

          {!displayedSession && !canStart ? (
            <div className="rounded-md border border-warning/25 bg-warning/10 p-3 text-sm leading-6 text-warning">
              {status.label === "Mantenimiento"
                ? "Esta toma está en mantenimiento."
                : status.label === "Deshabilitada"
                  ? "Esta toma no está habilitada para iniciar carga."
                  : "La toma no está disponible para iniciar carga."}
            </div>
          ) : null}

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

function getOutletRuntimeStatus(
  outlet: ControlledOutletSummary,
  session: ChargingSessionSummary | null,
  isCurrentOutletSession: boolean
) {
  if (session && isCurrentOutletSession) {
    return {
      label: session.status === "pending_start" ? "Iniciando" : "Cargando",
      variant: session.status === "pending_start" ? "pending_start" : "active"
    } as const;
  }

  if (session && !isCurrentOutletSession) {
    return { label: "Ocupada", variant: "reserved" } as const;
  }

  if (outlet.operationalStatus === "maintenance") {
    return { label: "Mantenimiento", variant: "warning" } as const;
  }

  if (outlet.operationalStatus === "disabled") {
    return { label: "Deshabilitada", variant: "offline" } as const;
  }

  if (outlet.operationalStatus === "reserved") {
    return { label: "Reservada", variant: "reserved" } as const;
  }

  if (outlet.status === "faulted" || outlet.status === "offline") {
    return { label: "Fuera de servicio", variant: outlet.status } as const;
  }

  return { label: outlet.status === "available" ? "Disponible" : outlet.statusLabel, variant: outlet.status } as const;
}

function outletStatusVariant(outlet: ControlledOutletSummary) {
  if (outlet.operationalStatus === "maintenance") {
    return "warning" as const;
  }

  if (outlet.operationalStatus === "disabled") {
    return "offline" as const;
  }

  if (outlet.operationalStatus === "occupied") {
    return "charging" as const;
  }

  return outlet.status;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-panel2/64 p-2">
      <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
