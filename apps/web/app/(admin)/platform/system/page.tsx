import { getTenantIsolationDiagnostics } from "@voltaria/db";
import { PlatformSystemDiagnostics } from "@/components/platform-admin";
import { requirePagePermission, withDbContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformSystemPage() {
  await requirePagePermission("system.health.view", "/platform/system");
  const diagnostics = await withDbContext(({ db }) => getTenantIsolationDiagnostics(db));

  return <PlatformSystemDiagnostics diagnostics={diagnostics} />;
}
