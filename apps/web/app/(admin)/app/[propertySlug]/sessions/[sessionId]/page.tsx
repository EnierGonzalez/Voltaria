import { renderTenantSessionDetail } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantSessionDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; sessionId: string }>;
}) {
  const { propertySlug, sessionId } = await params;
  return renderTenantSessionDetail(propertySlug, sessionId);
}
