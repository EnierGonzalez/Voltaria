"use client";

import {
  Bell,
  Building2,
  ChartSpline,
  CreditCard,
  FileText,
  LayoutDashboard,
  PlugZap,
  RadioTower,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
  Zap
} from "lucide-react";
import { usePathname } from "next/navigation";
import { AppShell, SidebarNav, TopBar } from "@voltaria/ui";
import type { AppPermission } from "@voltaria/shared";
import type { CurrentUser } from "@voltaria/db";
import { logoutAction } from "@/lib/actions/auth-actions";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { label: "Puntos", href: "/chargers", icon: PlugZap, permission: "outlets.view" },
  { label: "Tomas", href: "/outlets", icon: Zap, permission: "outlets.view" },
  { label: "Sessions", href: "/sessions", icon: Zap, permission: "sessions.view" },
  { label: "Residents", href: "/residents", icon: UsersRound, permission: "residents.view" },
  { label: "Billing", href: "/billing", icon: CreditCard, permission: "billing.view" },
  { label: "Audit", href: "/audit", icon: ShieldCheck, permission: "audit.view" },
  { label: "Consumption", href: "/consumption", icon: ChartSpline, permission: "dashboard.view" },
  { label: "Alerts", href: "/alerts", icon: TriangleAlert, badge: "3", permission: "alerts.view" },
  { label: "Reports", href: "/reports", icon: FileText, permission: "reports.view" },
  { label: "RFID Sim", href: "/rfid-simulator", icon: RadioTower, permission: "rfid_simulator.use" },
  { label: "Settings", href: "/settings", icon: Settings, permission: "rules.view" }
] satisfies Array<{
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission: AppPermission;
  badge?: string;
}>;

const titleByPath: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/chargers": "Puntos de carga",
  "/outlets": "Tomas 120V",
  "/sessions": "Sessions",
  "/residents": "Residents",
  "/billing": "Billing",
  "/billing/cycles": "Ciclos de corte",
  "/audit": "Auditoría",
  "/consumption": "Consumption",
  "/alerts": "Alerts",
  "/reports": "Reports",
  "/rfid-simulator": "RFID Simulator",
  "/settings": "Settings",
  "/settings/deployment": "Deployment",
  "/settings/rules": "Reglas operativas",
  "/settings/users": "Usuarios"
};

export function AdminShell({
  children,
  currentUser
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
}) {
  const pathname = usePathname();
  const title =
    titleByPath[pathname] ??
    (pathname.startsWith("/chargers/")
      ? "Detalle de punto"
      : pathname.startsWith("/outlets")
        ? "Tomas 120V"
        : pathname.startsWith("/billing/cycles")
          ? "Detalle de corte"
        : pathname.startsWith("/audit")
          ? "Auditoría"
        : pathname.startsWith("/settings/rules")
          ? "Reglas operativas"
        : pathname.startsWith("/settings/users")
          ? "Usuarios"
          : pathname.startsWith("/settings/deployment")
            ? "Deployment"
      : pathname.startsWith("/sessions/")
        ? "Session Detail"
        : "Voltaria");
  const property = currentUser.activeMembership;
  const nav = navItems.filter((item) => currentUser.permissions.includes(item.permission));

  return (
    <AppShell
      sidebar={
        <SidebarNav
          brand={{
            name: "Voltaria",
            subtitle: "Charging Point OS"
          }}
          items={nav.map((item) => {
            const Icon = item.icon;
            return {
              href: item.href,
              label: item.label,
              active:
                item.href === "/dashboard"
                  ? pathname === item.href
                  : pathname.startsWith(item.href),
              icon: <Icon className="h-4 w-4" aria-hidden="true" />,
              ...(item.badge ? { badge: item.badge } : {})
            };
          })}
          footerLabel={property?.propertyName ?? "Property"}
          footerMeta={currentUser.activeMembership?.role ?? "Sin rol activo"}
        />
      }
      topbar={
        <TopBar
          title={title}
          subtitle={
            property ? `${property.propertyName} · ${currentUser.fullName}` : currentUser.fullName
          }
          {...(property?.propertyName ? { propertyName: property.propertyName } : {})}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel2 text-muted transition hover:border-primary/60 hover:text-foreground"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground"
              >
                <Building2 className="h-4 w-4" aria-hidden="true" />
                {currentUser.activeMembership?.role ?? "Usuario"}
              </button>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground"
                >
                  Salir
                </button>
              </form>
            </div>
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
