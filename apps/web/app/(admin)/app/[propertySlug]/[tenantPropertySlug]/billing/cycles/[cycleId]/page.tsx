import { renderTenantBillingCycleDetail } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantBillingCycleDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string; cycleId: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug, cycleId } = await params;
  return renderTenantBillingCycleDetail(organizationSlug, tenantPropertySlug, cycleId);
}
