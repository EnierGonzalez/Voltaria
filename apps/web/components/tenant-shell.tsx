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
  ServerCog,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, SidebarNav, TopBar } from "@voltaria/ui";
import {
  getPermissionsForRole,
  hasAnyPermission,
  type AppPermission
} from "@voltaria/shared";
import type { CurrentUser } from "@voltaria/db";
import { logoutAction } from "@/lib/actions/auth-actions";

type TenantNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  permissions: AppPermission[];
  badge?: string;
};

const tenantNavItems: TenantNavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, permissions: ["dashboard.view"] },
  { label: "Puntos", path: "/chargers", icon: PlugZap, permissions: ["outlets.view"] },
  { label: "Tomas", path: "/outlets", icon: Zap, permissions: ["outlets.view"] },
  { label: "Sessions", path: "/sessions", icon: Zap, permissions: ["sessions.view"] },
  { label: "Residents", path: "/residents", icon: UsersRound, permissions: ["residents.view"] },
  { label: "Billing", path: "/billing", icon: CreditCard, permissions: ["billing.view"] },
  { label: "Audit", path: "/audit", icon: ShieldCheck, permissions: ["audit.view"] },
  { label: "Consumption", path: "/consumption", icon: ChartSpline, permissions: ["dashboard.view"] },
  { label: "Alerts", path: "/alerts", icon: TriangleAlert, permissions: ["alerts.view"], badge: "3" },
  { label: "Reports", path: "/reports", icon: FileText, permissions: ["reports.view"] },
  { label: "RFID Sim", path: "/rfid-simulator", icon: RadioTower, permissions: ["rfid_simulator.use"] },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
    permissions: ["rules.view", "users.view", "system.health.view"]
  }
];

const titleByTenantPath: Record<string, string> = {
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

export function TenantShell({
  children,
  currentUser
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
}) {
  const pathname = usePathname();
  const propertySlug = extractPropertySlug(pathname);
  const selectedMembership =
    currentUser.memberships.find((membership) => membership.propertySlug === propertySlug) ??
    currentUser.activeMembership;
  const selectedSlug = selectedMembership?.propertySlug ?? propertySlug ?? "";
  const basePath = selectedSlug ? `/app/${selectedSlug}` : "/select-property";
  const tenantPath = propertySlug ? normalizeTenantPath(pathname, propertySlug) : pathname;
  const tenantPermissions = selectedMembership
    ? getPermissionsForRole(selectedMembership.role)
    : currentUser.permissions;
  const nav = tenantNavItems.filter((item) => hasAnyPermission(tenantPermissions, item.permissions));
  const title =
    titleByTenantPath[tenantPath] ??
    (tenantPath.startsWith("/chargers/")
      ? "Detalle de punto"
      : tenantPath.startsWith("/sessions/")
        ? "Session Detail"
        : tenantPath.startsWith("/residents/")
          ? "Resident Detail"
          : tenantPath.startsWith("/billing/cycles/")
            ? "Detalle de corte"
            : "Voltaria");
  const propertyName = selectedMembership?.propertyName ?? (propertySlug ? propertySlug : "Selecciona propiedad");
  const roleLabel = selectedMembership?.role ?? (propertySlug ? "support" : "Sin rol activo");

  return (
    <AppShell
      sidebar={
        <SidebarNav
          brand={{ name: "Voltaria", subtitle: "Tenant Admin" }}
          items={nav.map((item) => {
            const Icon = item.icon;
            const href = `${basePath}${item.path}`;
            return {
              href,
              label: item.label,
              active: item.path === "/dashboard" ? tenantPath === item.path : tenantPath.startsWith(item.path),
              icon: <Icon className="h-4 w-4" aria-hidden="true" />,
              ...(item.badge ? { badge: item.badge } : {})
            };
          })}
          footerLabel={propertyName}
          footerMeta={roleLabel}
        />
      }
      topbar={
        <TopBar
          title={title}
          subtitle={`${propertyName} · ${currentUser.fullName}`}
          propertyName={propertyName}
          actions={
            <div className="flex items-center gap-2">
              {currentUser.permissions.includes("platform.tenants.view") ? (
                <Link
                  href="/platform"
                  className="hidden h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground sm:inline-flex"
                >
                  <ServerCog className="h-4 w-4" aria-hidden="true" />
                  Platform
                </Link>
              ) : null}
              {currentUser.memberships.length > 1 ? (
                <Link
                  href="/select-property"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground"
                >
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  Cambiar
                </Link>
              ) : null}
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel2 text-muted transition hover:border-primary/60 hover:text-foreground"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
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

function extractPropertySlug(pathname: string) {
  const match = pathname.match(/^\/app\/([^/]+)/);
  return match?.[1] ?? null;
}

function normalizeTenantPath(pathname: string, propertySlug: string) {
  const stripped = pathname.replace(`/app/${propertySlug}`, "");
  return stripped.length > 0 ? stripped : "/dashboard";
}
