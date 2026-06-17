import { renderTenantDashboard } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantDashboardPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug } = await params;
  return renderTenantDashboard(organizationSlug, tenantPropertySlug);
}
