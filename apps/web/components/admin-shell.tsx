"use client";

import { usePathname } from "next/navigation";
import type { CurrentUser } from "@voltaria/db";
import { PlatformShell } from "./platform-shell";
import { TenantShell } from "./tenant-shell";

export function AdminShell({
  children,
  currentUser
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/platform")) {
    return <PlatformShell currentUser={currentUser}>{children}</PlatformShell>;
  }

  return <TenantShell currentUser={currentUser}>{children}</TenantShell>;
}
