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
  consumptionSeries,
  dashboardStats,
  formatCurrency,
  formatDuration,
  formatKwh,
  formatPower,
  monthlyConsumptionSeries,
  recentAlerts,
  recentSessions,
  towerChargers,
  weeklyConsumptionSeries
} from "@voltaria/shared";
import { AlertItem } from "./alert-item";
import { ChargerStatusCard } from "./charger-status-card";
import { ConsumptionChart } from "./consumption-chart";
import { DashboardRecentSessions } from "./dashboard-recent-sessions";
import { InteractiveStatCard } from "./interactive-stat-card";

export function AdminDashboard() {
  const [attendedAlerts, setAttendedAlerts] = useState<Set<string>>(new Set());
  const openAlerts = useMemo(
    () => recentAlerts.filter((alert) => !attendedAlerts.has(alert.id)).length,
    [attendedAlerts]
  );

  return (
    <section className="grid auto-rows-min gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InteractiveStatCard
          title="Energía mensual"
          value={formatKwh(dashboardStats.monthlyKwh)}
          delta="+12.8% vs mes anterior"
          href="/consumption"
          tone="cyan"
          icon={<Bolt className="h-5 w-5" aria-hidden="true" />}
        />
        <InteractiveStatCard
          title="Sesiones activas"
          value={dashboardStats.activeSessions.toString()}
          delta={`${dashboardStats.availableConnectors} conectores disponibles`}
          href="/sessions?status=active"
          tone="success"
          icon={<Zap className="h-5 w-5" aria-hidden="true" />}
        />
        <InteractiveStatCard
          title="Ingresos estimados"
          value={formatCurrency(dashboardStats.monthlyRevenue)}
          delta={`${dashboardStats.billingReady} registros listos`}
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
            day: consumptionSeries,
            week: weeklyConsumptionSeries,
            month: monthlyConsumptionSeries
          }}
        />

        <SectionCard title="Estado de cargadores" description="Conectores por disponibilidad">
          <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1">
            {towerChargers.slice(0, 5).map((charger) => (
              <ChargerStatusCard key={charger.id} charger={charger} compact />
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid min-w-0 auto-rows-min items-start gap-6 xl:grid-cols-2">
        <SectionCard title="Sesiones recientes" description="Datos de sesión auditables">
          <DashboardRecentSessions sessions={recentSessions} />
        </SectionCard>

        <SectionCard title="Alertas" description={`${openAlerts} eventos abiertos en esta vista`}>
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
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Potencia actual"
          value={formatPower(dashboardStats.currentPowerKw)}
          delta="Suma de sesiones activas"
          tone="primary"
          icon={<Activity className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Tiempo promedio"
          value={formatDuration(dashboardStats.averageSessionMinutes)}
          delta="Últimos 30 días"
          tone="cyan"
          icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Residentes activos"
          value={dashboardStats.activeResidents.toString()}
          delta="Con credencial habilitada"
          tone="success"
          icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
        />
      </section>
    </section>
  );
}
