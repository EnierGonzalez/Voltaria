import { getPlatformTenants } from "@voltaria/db";
import { PlatformTenants } from "@/components/platform-admin";
import { requirePagePermission, withDbContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformTenantsPage() {
  const user = await requirePagePermission("platform.tenants.view", "/platform/tenants");
  const tenants = await withDbContext(({ db }) => getPlatformTenants(db));

  return <PlatformTenants tenants={tenants} canManage={user.permissions.includes("platform.tenants.manage")} />;
}
