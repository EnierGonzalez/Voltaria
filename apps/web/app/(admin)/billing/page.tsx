import { redirectLegacyTenantRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  await redirectLegacyTenantRoute("billing");
}
