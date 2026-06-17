import { redirectLegacyAppPropertyRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TenantChargerDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; chargerId: string }>;
}) {
  const { propertySlug, chargerId } = await params;
  await redirectLegacyAppPropertyRoute(propertySlug, `chargers/${chargerId}`);
}
