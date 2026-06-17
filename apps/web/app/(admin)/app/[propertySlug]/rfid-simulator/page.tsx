import { renderTenantRfidSimulator } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantRfidSimulatorPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  return renderTenantRfidSimulator(propertySlug);
}
