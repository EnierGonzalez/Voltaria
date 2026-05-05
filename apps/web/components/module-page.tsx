"use client";

import {
  BellRing,
  Building2,
  CalendarDays,
  ChartSpline,
  CreditCard,
  FileText,
  Gauge,
  PlugZap,
  Settings,
  UserRound,
  Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import {
  type AlertSummary,
  type BillingRecordSummary,
  type ChargerSummary,
  type ChargingSessionSummary,
  type ControlledOutletSummary,
  type ConsumptionPoint,
  type ResidentSummary,
  type TariffSummary,
  billingRecords,
  consumptionSeries,
  formatCurrency,
  formatDuration,
  formatKwh,
  formatPower,
  monthlyConsumptionSeries,
  recentAlerts,
  recentSessions,
  residents,
  tariffs,
  chargingPoints,
  towerOutlets,
  weeklyConsumptionSeries
} from "@voltaria/shared";
import { AlertItem } from "./alert-item";
import { ChargerStatusCard } from "./charger-status-card";
import { ConsumptionChart } from "./consumption-chart";
import { SessionTable } from "./session-table";
import {
  adminStopOutletSession
} from "@/lib/actions/outlet-actions";
import { setOutletAccessOverrideAction } from "@/lib/actions/rules-actions";

type ModuleKey =
  | "chargers"
  | "outlets"
  | "sessions"
  | "residents"
  | "billing"
  | "consumption"
  | "alerts"
  | "reports"
  | "settings";

export type ModulePageData = {
  chargers: ChargerSummary[];
  outlets: ControlledOutletSummary[];
  sessions: ChargingSessionSummary[];
  residents: ResidentSummary[];
  billingRecords: BillingRecordSummary[];
  alerts: AlertSummary[];
  tariffs: TariffSummary[];
  consumptionSeries: ConsumptionPoint[];
  weeklyConsumptionSeries: ConsumptionPoint[];
  monthlyConsumptionSeries: ConsumptionPoint[];
};

const defaultData: ModulePageData = {
  chargers: chargingPoints,
  outlets: towerOutlets,
  sessions: recentSessions,
  residents,
  billingRecords,
  alerts: recentAlerts,
  tariffs,
  consumptionSeries,
  weeklyConsumptionSeries,
  monthlyConsumptionSeries
};

const moduleCopy: Record<ModuleKey, { title: string; description: string }> = {
  chargers: {
    title: "Puntos de carga",
    description: "Tomas controladas y cargadores OCPP futuros"
  },
  outlets: {
    title: "Tomas 120V",
    description: "Control, medición y disponibilidad por toma"
  },
  sessions: {
    title: "Sessions",
    description: "Sesiones con energía, tiempo, potencia y costo"
  },
  residents: {
    title: "Residents",
    description: "Residentes, departamentos y acceso a carga"
  },
  billing: {
    title: "Billing",
    description: "Cargos calculados por sesión y periodo"
  },
  consumption: {
    title: "Consumption",
    description: "Consumo agregado por día y por torre"
  },
  alerts: {
    title: "Alerts",
    description: "Eventos operativos, severidad y estado"
  },
  reports: {
    title: "Reports",
    description: "Reportes listos para exportación y auditoría"
  },
  settings: {
    title: "Settings",
    description: "Propiedad, tarifas, conectividad y auth"
  }
};

export function ModulePage({ module, data = defaultData }: { module: ModuleKey; data?: ModulePageData }) {
  const copy = moduleCopy[module];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={copy.title}
          value={primaryValue(module, data)}
          delta={copy.description}
          tone={module === "alerts" ? "warning" : "primary"}
          icon={moduleIcon(module)}
        />
        <StatCard
          title="Property scope"
          value="Torre Aurora"
          delta="Todos los datos filtran por property_id"
          tone="cyan"
          icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Auditoría"
          value="OCPP raw"
          delta="Mensajes entrantes y salientes preservados"
          tone="success"
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      {renderModule(module, data)}
    </div>
  );
}

function primaryValue(module: ModuleKey, data: ModulePageData) {
  switch (module) {
    case "chargers":
      return data.chargers.length.toString();
    case "outlets":
      return data.outlets.length.toString();
    case "sessions":
      return data.sessions.length.toString();
    case "residents":
      return data.residents.length.toString();
    case "billing":
      return formatCurrency(data.billingRecords.reduce((sum, item) => sum + item.totalAmount, 0));
    case "consumption":
      return formatKwh(data.consumptionSeries.reduce((sum, item) => sum + item.kwh, 0));
    case "alerts":
      return data.alerts.length.toString();
    case "reports":
      return "6";
    case "settings":
      return "Base";
  }
}

function moduleIcon(module: ModuleKey) {
  const className = "h-5 w-5";
  switch (module) {
    case "chargers":
      return <PlugZap className={className} aria-hidden="true" />;
    case "outlets":
      return <Gauge className={className} aria-hidden="true" />;
    case "sessions":
      return <Zap className={className} aria-hidden="true" />;
    case "residents":
      return <UserRound className={className} aria-hidden="true" />;
    case "billing":
      return <CreditCard className={className} aria-hidden="true" />;
    case "consumption":
      return <ChartSpline className={className} aria-hidden="true" />;
    case "alerts":
      return <BellRing className={className} aria-hidden="true" />;
    case "reports":
      return <FileText className={className} aria-hidden="true" />;
    case "settings":
      return <Settings className={className} aria-hidden="true" />;
  }
}

function renderModule(module: ModuleKey, data: ModulePageData) {
  switch (module) {
    case "chargers":
      return <ChargersModule chargers={data.chargers} />;
    case "outlets":
      return <OutletsModule outlets={data.outlets} />;
    case "sessions":
      return <SessionsModule sessions={data.sessions} />;
    case "residents":
      return <ResidentsModule residents={data.residents} />;
    case "billing":
      return <BillingModule billingRecords={data.billingRecords} />;
    case "consumption":
      return <ConsumptionModule data={data} />;
    case "alerts":
      return <AlertsModule alerts={data.alerts} />;
    case "reports":
      return <ReportsModule />;
    case "settings":
      return <SettingsModule />;
  }
}

function ChargersModule({ chargers }: { chargers: ChargerSummary[] }) {
  return (
    <SectionCard title="Inventario de puntos de carga" description="Tomas 120V y compatibilidad OCPP">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {chargers.map((charger) => (
          <ChargerStatusCard key={charger.id} charger={charger} />
        ))}
      </div>
    </SectionCard>
  );
}

function OutletsModule({ outlets }: { outlets: ControlledOutletSummary[] }) {
  return (
    <SectionCard title="Tomas controladas 120V" description="16 canales simulados listos para hardware futuro">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {outlets.map((outlet) => (
          <div
            key={outlet.id}
            className="min-w-0 overflow-hidden rounded-lg border border-border bg-panel2/64 p-4 transition hover:border-cyan/50 hover:bg-panel2"
          >
            <a href={`/chargers/${outlet.id}`} className="block min-w-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{outlet.name}</p>
                  <p className="mt-1 truncate text-sm text-muted">{outlet.location}</p>
                </div>
                <StatusBadge variant={outletStatusVariant(outlet)}>
                  {outlet.operationalStatusLabel ?? outlet.statusLabel}
                </StatusBadge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <MiniStat label="Potencia" value={formatPower(outlet.currentPowerKw)} />
                <MiniStat label="Sesión" value={formatKwh(outlet.currentSessionKwh)} />
                <MiniStat label="Voltaje" value={`${outlet.voltage} V`} />
                <MiniStat label="Límite" value={`${outlet.appliedMaxCurrentAmp ?? outlet.maxCurrentAmp} A`} />
              </div>
            </a>
            <OutletAdminActions outlet={outlet} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function OutletAdminActions({ outlet }: { outlet: ControlledOutletSummary }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const runAction = (
    label: string,
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>
  ) => {
    const confirmed = window.confirm(`${label} ${outlet.code}?`);

    if (!confirmed) {
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await action();
        setMessage(result.ok ? result.message ?? "Comando creado." : result.error ?? "No se pudo crear el comando.");
        router.refresh();
      })();
    });
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <a
          href={`/chargers/${outlet.id}`}
          className="rounded-md border border-cyan/30 bg-cyan/10 px-2 py-1 text-xs font-semibold text-cyan transition hover:bg-cyan/20"
        >
          Ver detalle
        </a>
        {outlet.currentSessionId ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction("Detener sesión en", () => adminStopOutletSession(outlet.currentSessionId!))
            }
            className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-60"
          >
            Detener sesión
          </button>
        ) : null}
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            runAction("Poner en mantenimiento", () =>
              setOutletAccessOverrideAction({ outletId: outlet.id, status: "maintenance" })
            )
          }
          className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning transition hover:bg-warning/20 disabled:opacity-60"
        >
          Mantenimiento
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            runAction("Deshabilitar", () =>
              setOutletAccessOverrideAction({ outletId: outlet.id, status: "disabled" })
            )
          }
          className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-60"
        >
          Deshabilitar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            runAction("Habilitar", () =>
              setOutletAccessOverrideAction({ outletId: outlet.id, status: "available" })
            )
          }
          className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs font-semibold text-success transition hover:bg-success/20 disabled:opacity-60"
        >
          Habilitar
        </button>
      </div>
      {message ? <p className="text-xs leading-5 text-muted">{message}</p> : null}
    </div>
  );
}

function SessionsModule({ sessions }: { sessions: ChargingSessionSummary[] }) {
  return (
    <SectionCard title="Sesiones" description="Sin datos de batería del vehículo">
      <SessionTable sessions={sessions} />
    </SectionCard>
  );
}

function ResidentsModule({ residents }: { residents: ResidentSummary[] }) {
  return (
    <SectionCard title="Residentes" description="Acceso y asociación a departamentos">
      <DataTable
        headers={["Nombre", "Departamento", "Email", "Acceso", "Sesiones", "Consumo mensual"]}
        rows={residents.map((resident) => [
          <a key={resident.id} href={`/residents/${resident.id}`} className="font-semibold text-foreground transition hover:text-cyan">
            {resident.name}
          </a>,
          resident.apartmentNumber,
          resident.email,
          <StatusBadge key={resident.id} variant={resident.accessStatus}>
            {resident.accessLabel}
          </StatusBadge>,
          resident.sessionsThisMonth.toString(),
          formatKwh(resident.monthlyKwh)
        ])}
      />
    </SectionCard>
  );
}

function BillingModule({ billingRecords }: { billingRecords: BillingRecordSummary[] }) {
  return (
    <SectionCard title="Facturación" description="Cargos por energía y periodo">
      <DataTable
        headers={["Periodo", "Departamento", "Residente", "Energía", "Tarifa", "Total", "Estado"]}
        rows={billingRecords.map((record) => [
          record.period,
          record.apartmentNumber,
          record.residentName,
          formatKwh(record.kwh),
          `${formatCurrency(record.ratePerKwh)} / kWh`,
          formatCurrency(record.totalAmount),
          <StatusBadge key={record.id} variant={record.status}>
            {record.statusLabel}
          </StatusBadge>
        ])}
      />
    </SectionCard>
  );
}

function ConsumptionModule({ data }: { data: ModulePageData }) {
  return (
    <ConsumptionChart
      title="Consumo"
      description={`Energía entregada por día · tarifa base ${formatCurrency(data.tariffs[0]?.ratePerKwh ?? 0)} / kWh`}
      dataByRange={{
        day: data.consumptionSeries,
        week: data.weeklyConsumptionSeries,
        month: data.monthlyConsumptionSeries
      }}
    />
  );
}

function AlertsModule({ alerts }: { alerts: AlertSummary[] }) {
  const [attendedAlerts, setAttendedAlerts] = useState<Set<string>>(new Set());

  return (
    <SectionCard title="Alertas" description="Eventos con severidad y fuente">
      <div className="space-y-3">
        {alerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            attended={attendedAlerts.has(alert.id)}
            onAttend={(id) =>
              setAttendedAlerts((current) => {
                const next = new Set(current);
                next.add(id);
                return next;
              })
            }
          />
        ))}
      </div>
    </SectionCard>
  );
}

function ReportsModule() {
  const reports = [
    "Consumo por torre",
    "Facturación mensual",
    "Sesiones por residente",
    "Disponibilidad de cargadores",
    "Alertas operativas",
    "Auditoría OCPP"
  ];

  return (
    <SectionCard title="Reportes" description="Salidas base para operación y auditoría">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <div key={report} className="rounded-lg border border-border bg-panel2/58 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-panel text-cyan">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-4 font-medium text-foreground">{report}</p>
            <p className="mt-2 text-sm text-muted">Preparado para filtros por property_id y rango.</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SettingsModule() {
  return (
    <SectionCard title="Settings" description="Base preparada para proveedor de auth y migración">
      <div className="grid gap-4 md:grid-cols-2">
        <SettingItem icon={<Building2 className="h-5 w-5" aria-hidden="true" />} title="Multi-torre" value="property_id en tablas operativas" />
        <SettingItem icon={<Gauge className="h-5 w-5" aria-hidden="true" />} title="OCPP" value="Servidor separado y mensajes raw auditables" />
        <SettingItem icon={<CreditCard className="h-5 w-5" aria-hidden="true" />} title="Tarifas" value="Modelo por propiedad, vigencia y moneda" />
        <SettingItem icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />} title="Migración futura" value="Auth y DB sin acoplarse a Supabase" />
        <a href="/settings/rules">
          <SettingItem icon={<Gauge className="h-5 w-5" aria-hidden="true" />} title="Reglas operativas" value="Métodos, límites, horarios y overrides" />
        </a>
        <a href="/rfid-simulator">
          <SettingItem icon={<Zap className="h-5 w-5" aria-hidden="true" />} title="RFID Simulator" value="Herramienta dev para taps RFID simulados" />
        </a>
      </div>
    </SectionCard>
  );
}

function DataTable({
  headers,
  rows
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-panel2 text-xs uppercase tracking-[0.18em] text-muted">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-panel/60">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-56 px-4 py-3 text-muted first:text-foreground">
                  <div className="min-w-0 truncate">{cell}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel/60 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-panel/70 p-2">
      <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}

function outletStatusVariant(outlet: ControlledOutletSummary) {
  if (outlet.operationalStatus === "maintenance" || outlet.operationalStatus === "reserved") {
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

function SettingItem({
  icon,
  title,
  value
}: {
  icon: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex gap-4 rounded-lg border border-border bg-panel2/58 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-cyan">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted">{value}</p>
      </div>
    </div>
  );
}
