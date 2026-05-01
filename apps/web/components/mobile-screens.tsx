"use client";

import {
  Clock3,
  CreditCard,
  KeyRound,
  LineChart,
  PlugZap,
  QrCode,
  ShieldCheck,
  Timer,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard, StatusBadge } from "@voltaria/ui";
import {
  formatCurrency,
  formatDuration,
  formatKwh,
  formatPower,
  mobileMonthlyStatsSeries,
  mobileResident,
  mobileSessions,
  mobileWeeklyStatsSeries
} from "@voltaria/shared";
import { ConfirmDialog } from "./confirm-dialog";
import { ConsumptionChart } from "./consumption-chart";
import { MobileMetricCard } from "./mobile-metric-card";

const activeSession = mobileSessions[0]!;

export function MobileHomeScreen() {
  return (
    <div className="space-y-5">
      <SectionCard title={`Hola, ${mobileResident.firstName}`} description="Resumen de carga residencial">
        <div className="grid gap-3">
          <MobileMetricCard
            label="Energía este mes"
            value={formatKwh(mobileResident.monthlyKwh)}
            href="/mobile/stats"
            icon={<LineChart className="h-4 w-4" aria-hidden="true" />}
          />
          <MobileMetricCard
            label="Costo estimado"
            value={formatCurrency(mobileResident.monthlyCost)}
            href="/mobile/history"
            icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </SectionCard>

      <div className="grid gap-3">
        <ActiveChargeCard href="/mobile/charge" />
        <MobileMetricCard
          label="Historial"
          value={`${mobileSessions.length} sesiones recientes`}
          href="/mobile/history"
          icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
        />
      </div>
    </div>
  );
}

export function MobileChargeScreen() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stopped, setStopped] = useState(false);

  return (
    <div className="space-y-5">
      <SectionCard
        title="My Charge"
        description={`${activeSession.chargerCode} · ${activeSession.chargerLocation}`}
        action={<StatusBadge variant={stopped ? "interrupted" : activeSession.status}>{stopped ? "Detenida" : activeSession.statusLabel}</StatusBadge>}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-panel2/64 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-success">
                <PlugZap className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted">Sesión actual</p>
                <p className="truncate font-semibold text-foreground">{activeSession.chargerCode}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MobileMetricCard label="Energía entregada" value={formatKwh(activeSession.deliveredKwh)} />
            <MobileMetricCard label="Tiempo transcurrido" value={formatDuration(activeSession.durationMinutes)} />
            <MobileMetricCard label="Potencia actual" value={formatPower(stopped ? 0 : activeSession.powerKw)} />
            <MobileMetricCard label="Costo estimado" value={formatCurrency(activeSession.costAmount)} />
            <MobileMetricCard label="Tarifa" value={`${formatCurrency(activeSession.ratePerKwh)} / kWh`} className="col-span-2" />
            <MobileMetricCard label="Ubicación" value={activeSession.chargerLocation} className="col-span-2" />
          </div>

          {!stopped ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="min-h-11 w-full rounded-md border border-danger/40 bg-danger/12 px-4 text-sm font-semibold text-danger transition hover:bg-danger/20"
            >
              Detener carga
            </button>
          ) : null}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={confirmOpen}
        title="Detener carga"
        description="Esta confirmación es mock. La sesión cambiará a detenida solo en esta pantalla."
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

export function MobileStatsScreen() {
  const period = useMemo(() => {
    const totals = mobileWeeklyStatsSeries.reduce(
      (acc, item) => ({
        kwh: acc.kwh + item.kwh,
        sessions: acc.sessions + item.sessions,
        costAmount: acc.costAmount + item.costAmount
      }),
      { kwh: 0, sessions: 0, costAmount: 0 }
    );

    return {
      ...totals,
      averageKwh: totals.sessions > 0 ? totals.kwh / totals.sessions : 0
    };
  }, []);

  return (
    <div className="space-y-5">
      <ConsumptionChart
        title="Stats"
        description="Consumo residencial por periodo"
        compact
        ranges={["week", "month"]}
        dataByRange={{
          day: mobileWeeklyStatsSeries,
          week: mobileWeeklyStatsSeries,
          month: mobileMonthlyStatsSeries
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <MobileMetricCard label="kWh periodo" value={formatKwh(period.kwh)} />
        <MobileMetricCard label="Costo periodo" value={formatCurrency(period.costAmount)} />
        <MobileMetricCard label="Sesiones" value={period.sessions.toString()} />
        <MobileMetricCard label="Promedio" value={formatKwh(period.averageKwh)} />
      </div>
    </div>
  );
}

export function MobileAccessScreen() {
  const [secondsLeft, setSecondsLeft] = useState(300);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 300));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Access"
        description="Credencial de residente"
        action={<StatusBadge variant="success">Acceso autorizado</StatusBadge>}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-cyan/30 bg-panel2 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-cyan">
                <KeyRound className="h-6 w-6" aria-hidden="true" />
              </div>
              <StatusBadge variant="success">RFID activa</StatusBadge>
            </div>
            <p className="mt-6 text-sm text-muted">Residente</p>
            <p className="mt-1 truncate text-xl font-semibold text-foreground">{mobileResident.name}</p>
            <p className="mt-4 text-sm text-muted">RFID</p>
            <p className="mt-1 truncate text-lg font-semibold text-foreground">RFID-AUR-1204-ML</p>
          </div>

          <div className="rounded-lg border border-border bg-panel2/64 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <QrCode className="h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
                <p className="truncate text-sm font-medium text-foreground">QR temporal</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-warning">
                <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                {minutes}:{seconds.toString().padStart(2, "0")}
              </div>
            </div>
            <MockQr />
          </div>

          <MobileMetricCard
            label="Propiedad"
            value={mobileResident.propertyName}
            icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </SectionCard>
    </div>
  );
}

export function MobileAccountScreen() {
  return (
    <div className="space-y-5">
      <SectionCard title="Account" description="Perfil residencial">
        <div className="space-y-3">
          <MobileMetricCard label="Nombre" value={mobileResident.name} />
          <MobileMetricCard label="Email" value={mobileResident.email} />
          <MobileMetricCard label="Departamento" value={mobileResident.apartmentNumber} />
        </div>
      </SectionCard>
    </div>
  );
}

export function MobileHistoryScreen() {
  return (
    <div className="space-y-5">
      <SectionCard title="History" description="Sesiones recientes">
        <div className="space-y-3">
          {mobileSessions.map((session) => (
            <a
              key={session.id}
              href={`/mobile/history/${session.id}`}
              className="block min-w-0 overflow-hidden rounded-lg border border-border bg-panel2/64 p-4 transition hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{session.chargerCode}</p>
                  <p className="mt-1 truncate text-sm text-muted">{session.dateLabel}</p>
                </div>
                <StatusBadge variant={session.status}>{session.statusLabel}</StatusBadge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <Mini label="kWh" value={session.deliveredKwh.toFixed(1)} />
                <Mini label="Tiempo" value={formatDuration(session.durationMinutes)} />
                <Mini label="Costo" value={formatCurrency(session.costAmount)} />
              </div>
            </a>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export function MobileSessionDetailScreen({ sessionId }: { sessionId: string }) {
  const session = mobileSessions.find((item) => item.id === sessionId) ?? activeSession;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Session Detail"
        description={`${session.chargerCode} · ${session.apartmentNumber}`}
        action={<StatusBadge variant={session.status}>{session.statusLabel}</StatusBadge>}
      >
        <div className="space-y-3">
          <MobileMetricCard label="Residente" value={session.residentName} />
          <MobileMetricCard label="Departamento" value={session.apartmentNumber} />
          <MobileMetricCard label="Fecha" value={session.dateLabel} />
          <div className="grid grid-cols-2 gap-3">
            <MobileMetricCard label="Energía" value={formatKwh(session.deliveredKwh)} />
            <MobileMetricCard label="Tiempo" value={formatDuration(session.durationMinutes)} />
            <MobileMetricCard label="Potencia" value={formatPower(session.powerKw)} />
            <MobileMetricCard label="Costo" value={formatCurrency(session.costAmount)} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function ActiveChargeCard({ href }: { href?: string }) {
  const content = (
    <SectionCard
      title="My Charge"
      description={`${activeSession.chargerCode} · ${activeSession.apartmentNumber}`}
      action={<StatusBadge variant={activeSession.status}>{activeSession.statusLabel}</StatusBadge>}
    >
      <div className="rounded-lg border border-border bg-panel2/64 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-success">
            <PlugZap className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-muted">Sesión actual</p>
            <p className="truncate font-semibold text-foreground">{formatPower(activeSession.powerKw)}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Mini label="Energía" value={formatKwh(activeSession.deliveredKwh)} icon={<Zap className="h-3.5 w-3.5" />} />
          <Mini label="Tiempo" value={formatDuration(activeSession.durationMinutes)} icon={<Clock3 className="h-3.5 w-3.5" />} />
          <Mini label="Costo" value={formatCurrency(activeSession.costAmount)} icon={<CreditCard className="h-3.5 w-3.5" />} />
        </div>
      </div>
    </SectionCard>
  );

  return href ? (
    <a href={href} className="block transition hover:-translate-y-0.5">
      {content}
    </a>
  ) : (
    content
  );
}

function Mini({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-panel/70 p-2">
      <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MockQr() {
  const activeCells = new Set([
    0, 1, 2, 4, 6, 7, 8, 9, 12, 14, 17, 18, 20, 22, 24, 26, 29, 30, 32, 35, 38,
    40, 42, 43, 46, 48, 50, 53, 54, 56, 58, 60, 62, 63, 64, 66, 68, 72, 74, 76,
    78, 80
  ]);

  return (
    <div className="mx-auto mt-4 grid h-40 w-40 grid-cols-9 gap-1 rounded-lg border border-border bg-panel p-3">
      {Array.from({ length: 81 }, (_, index) => (
        <div
          key={index}
          className={activeCells.has(index) ? "rounded-sm bg-cyan" : "rounded-sm bg-panel2"}
        />
      ))}
    </div>
  );
}
