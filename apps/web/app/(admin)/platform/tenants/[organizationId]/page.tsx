import { notFound } from "next/navigation";
import { getPlatformTenantDetail } from "@voltaria/db";
import { PlatformTenantDetailView } from "@/components/platform-admin";
import { requirePagePermission, withDbContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformTenantDetailPage({
  params
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const user = await requirePagePermission("platform.tenants.view", "/platform/tenants");
  const { organizationId } = await params;
  const detail = await withDbContext(({ db }) => getPlatformTenantDetail(db, organizationId));

  if (!detail) {
    notFound();
  }

  return (
    <PlatformTenantDetailView
      detail={detail}
      canManageGateways={user.permissions.includes("platform.gateways.manage")}
    />
  );
}
