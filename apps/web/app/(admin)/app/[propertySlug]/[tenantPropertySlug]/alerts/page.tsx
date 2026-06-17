import { renderTenantModule } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantAlertsPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug } = await params;
  return renderTenantModule(organizationSlug, tenantPropertySlug, "alerts", "alerts.view");
}
