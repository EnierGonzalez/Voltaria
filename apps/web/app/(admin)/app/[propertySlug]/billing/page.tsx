import { renderTenantBilling } from "@/lib/tenant-page-renderers";

export const dynamic = "force-dynamic";

export default async function TenantBillingPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  return renderTenantBilling(propertySlug);
}
