import { redirectLegacyTenantRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChargersPage() {
  await redirectLegacyTenantRoute("chargers");
}
