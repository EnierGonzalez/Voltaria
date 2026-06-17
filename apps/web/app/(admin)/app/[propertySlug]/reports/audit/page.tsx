import { renderTenantAudit } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantReportsAuditPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  return renderTenantAudit(propertySlug);
}
