"use client";

import {
  Bell,
  Building2,
  ChartSpline,
  CreditCard,
  FileText,
  LayoutDashboard,
  PlugZap,
  Settings,
  TriangleAlert,
  UsersRound,
  Zap
} from "lucide-react";
import { usePathname } from "next/navigation";
import { AppShell, SidebarNav, TopBar } from "@voltaria/ui";
import { mockProperties } from "@voltaria/shared";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Puntos", href: "/chargers", icon: PlugZap },
  { label: "Tomas", href: "/outlets", icon: Zap },
  { label: "Sessions", href: "/sessions", icon: Zap },
  { label: "Residents", href: "/residents", icon: UsersRound },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Consumption", href: "/consumption", icon: ChartSpline },
  { label: "Alerts", href: "/alerts", icon: TriangleAlert, badge: "3" },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings }
];

const titleByPath: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/chargers": "Puntos de carga",
  "/outlets": "Tomas 120V",
  "/sessions": "Sessions",
  "/residents": "Residents",
  "/billing": "Billing",
  "/consumption": "Consumption",
  "/alerts": "Alerts",
  "/reports": "Reports",
  "/settings": "Settings"
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title =
    titleByPath[pathname] ??
    (pathname.startsWith("/chargers/")
      ? "Detalle de punto"
      : pathname.startsWith("/outlets")
        ? "Tomas 120V"
      : pathname.startsWith("/sessions/")
        ? "Session Detail"
        : "Voltaria");
  const property = mockProperties[0];

  return (
    <AppShell
      sidebar={
        <SidebarNav
          brand={{
            name: "Voltaria",
            subtitle: "Charging Point OS"
          }}
          items={navItems.map((item) => {
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
          footerLabel={property?.name ?? "Property"}
          footerMeta={property?.address ?? "Sin propiedad activa"}
        />
      }
      topbar={
        <TopBar
          title={title}
          subtitle={property ? `${property.name} · ${property.address}` : "Operación"}
          {...(property?.name ? { propertyName: property.name } : {})}
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
                Operación
              </button>
            </div>
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
