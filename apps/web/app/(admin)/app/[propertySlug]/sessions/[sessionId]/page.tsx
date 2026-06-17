import { redirectLegacyAppPropertyRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TenantSessionDetailPage({
  params
}: {
  params: Promise<{ propertySlug: string; sessionId: string }>;
}) {
  const { propertySlug, sessionId } = await params;
  await redirectLegacyAppPropertyRoute(propertySlug, `sessions/${sessionId}`);
}
