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
import { useState, type ReactNode } from "react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import {
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
  towerChargers,
  weeklyConsumptionSeries
} from "@voltaria/shared";
import { AlertItem } from "./alert-item";
import { ChargerStatusCard } from "./charger-status-card";
import { ConsumptionChart } from "./consumption-chart";
import { SessionTable } from "./session-table";

type ModuleKey =
  | "chargers"
  | "sessions"
  | "residents"
  | "billing"
  | "consumption"
  | "alerts"
  | "reports"
  | "settings";

const moduleCopy: Record<ModuleKey, { title: string; description: string }> = {
  chargers: {
    title: "Chargers",
    description: "Inventario, conectores y estado operativo por torre"
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

export function ModulePage({ module }: { module: ModuleKey }) {
  const copy = moduleCopy[module];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={copy.title}
          value={primaryValue(module)}
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

      {renderModule(module)}
    </div>
  );
}

function primaryValue(module: ModuleKey) {
  switch (module) {
    case "chargers":
      return towerChargers.length.toString();
    case "sessions":
      return recentSessions.length.toString();
    case "residents":
      return residents.length.toString();
    case "billing":
      return formatCurrency(billingRecords.reduce((sum, item) => sum + item.totalAmount, 0));
    case "consumption":
      return formatKwh(consumptionSeries.reduce((sum, item) => sum + item.kwh, 0));
    case "alerts":
      return recentAlerts.length.toString();
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

function renderModule(module: ModuleKey) {
  switch (module) {
    case "chargers":
      return <ChargersModule />;
    case "sessions":
      return <SessionsModule />;
    case "residents":
      return <ResidentsModule />;
    case "billing":
      return <BillingModule />;
    case "consumption":
      return <ConsumptionModule />;
    case "alerts":
      return <AlertsModule />;
    case "reports":
      return <ReportsModule />;
    case "settings":
      return <SettingsModule />;
  }
}

function ChargersModule() {
  return (
    <SectionCard title="Inventario de cargadores" description="Estado por conector y ubicación">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {towerChargers.map((charger) => (
          <ChargerStatusCard key={charger.id} charger={charger} />
        ))}
      </div>
    </SectionCard>
  );
}

function SessionsModule() {
  return (
    <SectionCard title="Sesiones" description="Sin datos de batería del vehículo">
      <SessionTable sessions={recentSessions} />
    </SectionCard>
  );
}

function ResidentsModule() {
  return (
    <SectionCard title="Residentes" description="Acceso y asociación a departamentos">
      <DataTable
        headers={["Nombre", "Departamento", "Email", "Acceso", "Sesiones", "Consumo mensual"]}
        rows={residents.map((resident) => [
          resident.name,
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

function BillingModule() {
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

function ConsumptionModule() {
  return (
    <ConsumptionChart
      title="Consumo"
      description={`Energía entregada por día · tarifa base ${formatCurrency(tariffs[0]?.ratePerKwh ?? 0)} / kWh`}
      dataByRange={{
        day: consumptionSeries,
        week: weeklyConsumptionSeries,
        month: monthlyConsumptionSeries
      }}
    />
  );
}

function AlertsModule() {
  const [attendedAlerts, setAttendedAlerts] = useState<Set<string>>(new Set());

  return (
    <SectionCard title="Alertas" description="Eventos con severidad y fuente">
      <div className="space-y-3">
        {recentAlerts.map((alert) => (
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
