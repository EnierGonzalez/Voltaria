import { renderTenantResidentDetail } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantResidentDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; residentId: string }>;
}) {
  const { propertySlug, residentId } = await params;
  return renderTenantResidentDetail(propertySlug, residentId);
}
