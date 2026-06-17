import { redirectLegacyAppPropertyRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TenantSessionsPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  await redirectLegacyAppPropertyRoute(propertySlug, "sessions");
}
