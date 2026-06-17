import { renderTenantAudit } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantAuditPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug } = await params;
  return renderTenantAudit(organizationSlug, tenantPropertySlug);
}
