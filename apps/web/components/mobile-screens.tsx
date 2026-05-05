"use client";

import {
  AlertTriangle,
  Clock3,
  CreditCard,
  KeyRound,
  LineChart,
  PlugZap,
  ShieldCheck,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";
import { SectionCard, StatusBadge } from "@voltaria/ui";
import {
  formatCurrency,
  formatDuration,
  formatKwh,
  formatPower,
  mobileAccessSummary,
  mobileMonthlyStatsSeries,
  mobileResident,
  mobileSessions,
  mobileWeeklyStatsSeries,
  type MobileAccessSummary
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
          label="Tomas disponibles"
          value="Seleccionar toma 120V"
          href="/mobile/outlets"
          icon={<PlugZap className="h-4 w-4" aria-hidden="true" />}
        />
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

export function MobileAccessScreen({
  data = mobileAccessSummary
}: {
  data?: MobileAccessSummary;
}) {
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const credential = data.credential;
  const isActive = data.status === "active" && credential?.status === "active";
  const isSuspended = data.status === "suspended" || credential?.status === "suspended";
  const statusVariant = isActive ? "success" : "warning";

  return (
    <div className="space-y-5">
      <SectionCard
        title="Acceso"
        description="Usa tu tarjeta RFID para iniciar una sesión de carga."
        action={<StatusBadge variant={statusVariant}>{data.statusLabel}</StatusBadge>}
      >
        <div className="space-y-4">
          {credential ? (
            <div
              className={
                isSuspended
                  ? "rounded-lg border border-warning/35 bg-warning/10 p-5"
                  : "rounded-lg border border-cyan/30 bg-panel2 p-5"
              }
            >
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={
                      isSuspended
                        ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-warning/30 bg-panel text-warning"
                        : "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-cyan"
                    }
                  >
                    {isSuspended ? (
                      <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                    ) : (
                      <KeyRound className="h-6 w-6" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted">Tarjeta RFID principal</p>
                    <p className="mt-1 truncate text-xl font-semibold text-foreground">
                      {credential.maskedValue}
                    </p>
                  </div>
                </div>
                <StatusBadge variant={isSuspended ? "warning" : "success"}>
                  {credential.statusLabel}
                </StatusBadge>
              </div>

              <p className="mt-4 text-xs leading-5 text-muted">
                Por seguridad, solo mostramos los últimos caracteres de tu tarjeta.
              </p>

              {isSuspended ? (
                <div className="mt-4 rounded-md border border-warning/25 bg-panel/70 p-3 text-sm text-warning">
                  Tu tarjeta RFID está suspendida. Contacta a administración para revisar tu acceso.
                </div>
              ) : null}

              <div className="mt-5 grid gap-3">
                <MobileMetricCard label="Residente" value={credential.residentName} />
                <div className="grid grid-cols-2 gap-3">
                  <MobileMetricCard label="Departamento" value={credential.apartmentNumber} />
                  <MobileMetricCard label="Estado" value={credential.statusLabel} />
                </div>
                <MobileMetricCard
                  label="Propiedad"
                  value={credential.propertyName}
                  icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-warning/35 bg-warning/10 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-warning/30 bg-panel text-warning">
                  <KeyRound className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">
                    No tienes una tarjeta RFID asignada.
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    Contacta a administración para solicitar una tarjeta.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                setInfoDialog({
                  title: "Reportar tarjeta perdida",
                  description:
                    "Para bloquear una tarjeta perdida, contacta a administración. En una fase posterior este flujo permitirá bloquearla directamente desde la app."
                })
              }
              className="min-h-11 rounded-md border border-border bg-panel2 px-3 text-sm font-semibold text-foreground transition hover:border-warning/50 hover:text-warning"
            >
              Reportar tarjeta perdida
            </button>
            <button
              type="button"
              onClick={() =>
                setInfoDialog({
                  title: "Solicitar reemplazo",
                  description:
                    "Administración deberá desactivar tu tarjeta anterior y asignarte una nueva tarjeta RFID."
                })
              }
              className="min-h-11 rounded-md border border-border bg-panel2 px-3 text-sm font-semibold text-foreground transition hover:border-cyan/50 hover:text-cyan"
            >
              Solicitar reemplazo
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Cómo iniciar una carga" description="Autorización con tarjeta física">
        <ol className="space-y-3">
          {[
            "Conecta tu vehículo al cargador.",
            "Pasa tu tarjeta RFID por el lector del cargador.",
            "Espera la autorización.",
            "La carga iniciará si tu acceso está activo."
          ].map((step, index) => (
            <li key={step} className="flex gap-3 rounded-lg border border-border bg-panel2/64 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan/30 bg-cyan/10 text-xs font-semibold text-cyan">
                {index + 1}
              </span>
              <span className="min-w-0 text-sm leading-6 text-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </SectionCard>

      <InfoDialog dialog={infoDialog} onClose={() => setInfoDialog(null)} />
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

function InfoDialog({
  dialog,
  onClose
}: {
  dialog: { title: string; description: string } | null;
  onClose: () => void;
}) {
  if (!dialog) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/74 p-4 backdrop-blur sm:items-center">
      <div className="w-full max-w-sm rounded-lg border border-border bg-panel p-4 shadow-premium">
        <h2 className="text-base font-semibold text-foreground">{dialog.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{dialog.description}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-10 w-full rounded-md border border-cyan/40 bg-cyan/10 px-3 text-sm font-semibold text-cyan transition hover:bg-cyan/15"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
