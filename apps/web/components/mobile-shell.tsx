"use client";

import { History, Home, IdCard, LineChart, PlugZap, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@voltaria/ui";
import type { CurrentUser } from "@voltaria/db";

const mobileNav = [
  { href: "/mobile/home", label: "Home", icon: Home },
  { href: "/mobile/charge", label: "My Charge", icon: PlugZap },
  { href: "/mobile/stats", label: "Stats", icon: LineChart },
  { href: "/mobile/access", label: "Access", icon: IdCard },
  { href: "/mobile/history", label: "History", icon: History },
  { href: "/mobile/account", label: "Account", icon: UserRound }
];

export function MobileShell({
  children,
  currentUser
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
}) {
  const pathname = usePathname();
  const residentLabel =
    currentUser.activeMembership?.apartmentNumber ?? currentUser.fullName ?? "Voltaria";
  const initials = currentUser.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border bg-background premium-grid">
        <header className="sticky top-0 z-20 border-b border-border bg-background/92 px-5 py-4 backdrop-blur">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan">Voltaria</p>
              <h1 className="mt-1 truncate text-lg font-semibold text-foreground">{residentLabel}</h1>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-panel2 text-sm font-semibold text-success">
              {initials || "V"}
            </div>
          </div>
        </header>

        <div className="flex-1 px-5 py-5 pb-32">{children}</div>

        <nav className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-md -translate-x-1/2 grid-cols-6 border-t border-border bg-panel/96 px-2 py-2 backdrop-blur">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/mobile/home" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium text-muted transition",
                  active && "bg-panel2 text-cyan"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="max-w-full truncate">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
