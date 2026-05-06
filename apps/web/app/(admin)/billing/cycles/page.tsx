import { BillingWorkspace } from "@/components/billing-workspace";
import { getBillingPageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BillingCyclesPage() {
  await requirePagePermission("billing.view", "/billing/cycles");
  const data = await getBillingPageData();

  return <BillingWorkspace cycles={data.cycles} audits={data.audits} sessions={data.sessions} />;
}
