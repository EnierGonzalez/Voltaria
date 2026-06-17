import { renderTenantSessionDetail } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantSessionDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string; sessionId: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug, sessionId } = await params;
  return renderTenantSessionDetail(organizationSlug, tenantPropertySlug, sessionId);
}
