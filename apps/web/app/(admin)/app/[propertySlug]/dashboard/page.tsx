import { renderTenantDashboard } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantDashboardPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  return renderTenantDashboard(propertySlug);
}
