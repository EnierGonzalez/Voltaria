import { renderTenantModule } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantConsumptionPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  return renderTenantModule(propertySlug, "consumption", "dashboard.view");
}
