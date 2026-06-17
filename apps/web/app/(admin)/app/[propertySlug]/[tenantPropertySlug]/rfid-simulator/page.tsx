import { renderTenantRfidSimulator } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantRfidSimulatorPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug } = await params;
  return renderTenantRfidSimulator(organizationSlug, tenantPropertySlug);
}
