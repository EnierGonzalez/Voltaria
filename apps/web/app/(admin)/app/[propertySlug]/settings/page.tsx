import { renderTenantSettings } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantSettingsPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  return renderTenantSettings(propertySlug);
}
