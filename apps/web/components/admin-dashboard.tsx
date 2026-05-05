"use client";

import {
  Activity,
  Bolt,
  Clock3,
  CreditCard,
  TriangleAlert,
  UsersRound,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";
import { SectionCard, StatCard } from "@voltaria/ui";
import {
  type AlertSummary,
  type ChargerSummary,
  type ChargingSessionSummary,
  type ConsumptionPoint,
  consumptionSeries,
  dashboardStats,
  formatCurrency,
  formatDuration,
  formatKwh,
  formatPower,
  monthlyConsumptionSeries,
  recentAlerts,
  recentSessions,
  chargingPoints,
  weeklyConsumptionSeries
} from "@voltaria/shared";
import { AlertItem } from "./alert-item";
import { ChargerStatusCard } from "./charger-status-card";
import { ConsumptionChart } from "./consumption-chart";
import { DashboardRecentSessions } from "./dashboard-recent-sessions";
import { InteractiveStatCard } from "./interactive-stat-card";

export type AdminDashboardData = {
  dashboardStats: typeof dashboardStats;
  chargers: ChargerSummary[];
  sessions: ChargingSessionSummary[];
  alerts: AlertSummary[];
  consumptionSeries: ConsumptionPoint[];
  weeklyConsumptionSeries: ConsumptionPoint[];
  monthlyConsumptionSeries: ConsumptionPoint[];
};

const defaultData: AdminDashboardData = {
  dashboardStats,
  chargers: chargingPoints,
  sessions: recentSessions,
  alerts: recentAlerts,
  consumptionSeries,
  weeklyConsumptionSeries,
  monthlyConsumptionSeries
};

export function AdminDashboard({ data = defaultData }: { data?: AdminDashboardData }) {
  const [attendedAlerts, setAttendedAlerts] = useState<Set<string>>(new Set());
  const openAlerts = useMemo(
    () => data.alerts.filter((alert) => !attendedAlerts.has(alert.id)).length,
    [attendedAlerts, data.alerts]
  );

  return (
    <section className="grid auto-rows-min gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InteractiveStatCard
          title="Energía mensual"
          value={formatKwh(data.dashboardStats.monthlyKwh)}
          delta="+12.8% vs mes anterior"
          href="/consumption"
          tone="cyan"
          icon={<Bolt className="h-5 w-5" aria-hidden="true" />}
        />
        <InteractiveStatCard
          title="Sesiones activas"
          value={data.dashboardStats.activeSessions.toString()}
          delta={`${data.dashboardStats.availableConnectors} tomas disponibles`}
          href="/sessions?status=active"
          tone="success"
          icon={<Zap className="h-5 w-5" aria-hidden="true" />}
        />
        <InteractiveStatCard
          title="Ingresos estimados"
          value={formatCurrency(data.dashboardStats.monthlyRevenue)}
          delta={`${data.dashboardStats.billingReady} registros listos`}
          href="/billing"
          tone="primary"
          icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
        />
        <InteractiveStatCard
          title="Alertas abiertas"
          value={openAlerts.toString()}
          delta={openAlerts === 1 ? "1 requiere atención" : `${openAlerts} requieren atención`}
          href="/alerts"
          tone="warning"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      <section className="grid min-w-0 auto-rows-min items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ConsumptionChart
          dataByRange={{
            day: data.consumptionSeries,
            week: data.weeklyConsumptionSeries,
            month: data.monthlyConsumptionSeries
          }}
        />

        <SectionCard title="Estado de tomas" description="Puntos 120V por disponibilidad">
          <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1">
            {data.chargers.slice(0, 5).map((charger) => (
              <ChargerStatusCard key={charger.id} charger={charger} compact />
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid min-w-0 auto-rows-min items-start gap-6 xl:grid-cols-2">
        <SectionCard title="Sesiones recientes" description="Datos de sesión auditables">
          <DashboardRecentSessions sessions={data.sessions} />
        </SectionCard>

        <SectionCard title="Alertas" description={`${openAlerts} eventos abiertos en esta vista`}>
          <div className="space-y-3">
            {data.alerts.map((alert) => (
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
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Potencia actual"
          value={formatPower(data.dashboardStats.currentPowerKw)}
          delta="Suma de sesiones activas"
          tone="primary"
          icon={<Activity className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Tiempo promedio"
          value={formatDuration(data.dashboardStats.averageSessionMinutes)}
          delta="Últimos 30 días"
          tone="cyan"
          icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Residentes activos"
          value={data.dashboardStats.activeResidents.toString()}
          delta="Con credencial habilitada"
          tone="success"
          icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
        />
      </section>
    </section>
  );
}
