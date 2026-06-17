import { renderTenantUsersSettings } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantUsersSettingsPage({
  params
}: {
  params: Promise<{ propertySlug: string; tenantPropertySlug: string }>;
}) {
  const { propertySlug: organizationSlug, tenantPropertySlug } = await params;
  return renderTenantUsersSettings(organizationSlug, tenantPropertySlug);
}
