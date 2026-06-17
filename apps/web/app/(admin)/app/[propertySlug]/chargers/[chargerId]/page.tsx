import { renderTenantChargerDetail } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantChargerDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; chargerId: string }>;
}) {
  const { propertySlug, chargerId } = await params;
  return renderTenantChargerDetail(propertySlug, chargerId);
}
