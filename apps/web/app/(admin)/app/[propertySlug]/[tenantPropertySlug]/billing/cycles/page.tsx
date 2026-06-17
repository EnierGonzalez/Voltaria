import { renderTenantBilling } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantBillingCyclesPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug } = await params;
  return renderTenantBilling(organizationSlug, tenantPropertySlug);
}
