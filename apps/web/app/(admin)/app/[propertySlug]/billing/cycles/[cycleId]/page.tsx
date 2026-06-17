import { redirectLegacyAppPropertyRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TenantBillingCycleDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; cycleId: string }>;
}) {
  const { propertySlug, cycleId } = await params;
  await redirectLegacyAppPropertyRoute(propertySlug, `billing/cycles/${cycleId}`);
}
