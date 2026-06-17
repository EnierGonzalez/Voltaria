import { renderTenantUsersSettings } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantUsersSettingsPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  return renderTenantUsersSettings(propertySlug);
}
