import { getPlatformGateways } from "@voltaria/db";
import { PlatformGateways } from "@/components/platform-admin";
import { requirePagePermission, withDbContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformGatewaysPage() {
  const user = await requirePagePermission("platform.gateways.view", "/platform/gateways");
  const gateways = await withDbContext(({ db }) => getPlatformGateways(db));

  return (
    <PlatformGateways
      gateways={gateways}
      canManage={user.permissions.includes("platform.gateways.manage")}
    />
  );
}
