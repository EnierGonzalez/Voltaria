"use client";

import {
  Bell,
  Building2,
  LifeBuoy,
  RadioTower,
  ServerCog,
  Settings,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AppShell, SidebarNav, TopBar } from "@voltaria/ui";
import type { AppPermission } from "@voltaria/shared";
import type { CurrentUser } from "@voltaria/db";
import { logoutAction } from "@/lib/actions/auth-actions";

type PlatformNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: AppPermission;
};

const platformNavItems: PlatformNavItem[] = [
  { label: "Overview", href: "/platform", icon: ServerCog, permission: "platform.tenants.view" },
  { label: "Tenants", href: "/platform/tenants", icon: Building2, permission: "platform.tenants.view" },
  { label: "Gateways", href: "/platform/gateways", icon: RadioTower, permission: "platform.gateways.view" },
  { label: "Users", href: "/platform/users", icon: UsersRound, permission: "platform.tenants.view" },
  { label: "Support", href: "/platform/support", icon: LifeBuoy, permission: "system.health.view" },
  { label: "System", href: "/platform/system", icon: ShieldCheck, permission: "system.health.view" },
  { label: "Settings", href: "/platform/settings", icon: Settings, permission: "platform.tenants.view" }
];

const titleByPath: Record<string, string> = {
  "/platform": "Platform",
  "/platform/tenants": "Tenants",
  "/platform/tenants/new": "Nuevo tenant",
  "/platform/gateways": "Gateways",
  "/platform/users": "Platform users",
  "/platform/support": "Support",
  "/platform/system": "System",
  "/platform/settings": "Platform settings"
};

export function PlatformShell({
  children,
  currentUser
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
}) {
  const pathname = usePathname();
  const nav = platformNavItems.filter((item) => currentUser.permissions.includes(item.permission));
  const title =
    titleByPath[pathname] ??
    (pathname.startsWith("/platform/tenants/") ? "Tenant" : "Voltaria Platform");

  return (
    <AppShell
      sidebar={
        <SidebarNav
          brand={{ name: "Voltaria", subtitle: "Platform Admin" }}
          items={nav.map((item) => {
            const Icon = item.icon;
            return {
              href: item.href,
              label: item.label,
              active: item.href === "/platform" ? pathname === item.href : pathname.startsWith(item.href),
              icon: <Icon className="h-4 w-4" aria-hidden="true" />
            };
          })}
          footerLabel="Voltaria Platform"
          footerMeta={currentUser.platformRole}
        />
      }
      topbar={
        <TopBar
          title={title}
          subtitle={`Scope global SaaS · ${currentUser.fullName}`}
          propertyName="Platform"
          actions={
            <div className="flex items-center gap-2">
              {currentUser.memberships.length > 0 ? (
                <Link
                  href="/select-property"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-panel2 px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground"
                >
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  Ir a tenant
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
