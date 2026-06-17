import { renderTenantRulesSettings } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantRulesSettingsPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  return renderTenantRulesSettings(propertySlug);
}
