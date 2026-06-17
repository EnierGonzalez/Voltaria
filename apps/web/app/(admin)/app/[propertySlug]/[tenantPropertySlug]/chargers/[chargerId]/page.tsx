import { renderTenantChargerDetail } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantChargerDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string; chargerId: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug, chargerId } = await params;
  return renderTenantChargerDetail(organizationSlug, tenantPropertySlug, chargerId);
}
