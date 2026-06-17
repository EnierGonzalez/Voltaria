import { renderTenantBillingCycleDetail } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantBillingCycleDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; cycleId: string }>;
}) {
  const { propertySlug, cycleId } = await params;
  return renderTenantBillingCycleDetail(propertySlug, cycleId);
}
