import { renderTenantResidentDetail } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantResidentDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string; residentId: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug, residentId } = await params;
  return renderTenantResidentDetail(organizationSlug, tenantPropertySlug, residentId);
}
