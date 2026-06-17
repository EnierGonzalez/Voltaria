import { getPlatformDashboardSummary } from "@voltaria/db";
import { PlatformDashboard } from "@/components/platform-admin";
import { requirePagePermission, withDbContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  await requirePagePermission("platform.tenants.view", "/platform");
  const summary = await withDbContext(({ db }) => getPlatformDashboardSummary(db));

  return <PlatformDashboard summary={summary} />;
}
