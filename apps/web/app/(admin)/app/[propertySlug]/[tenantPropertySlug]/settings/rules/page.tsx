import { renderTenantRulesSettings } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantRulesSettingsPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug } = await params;
  return renderTenantRulesSettings(organizationSlug, tenantPropertySlug);
}
