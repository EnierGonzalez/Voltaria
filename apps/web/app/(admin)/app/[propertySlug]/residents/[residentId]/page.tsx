import { redirectLegacyAppPropertyRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TenantResidentDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; residentId: string }>;
}) {
  const { propertySlug, residentId } = await params;
  await redirectLegacyAppPropertyRoute(propertySlug, `residents/${residentId}`);
}
