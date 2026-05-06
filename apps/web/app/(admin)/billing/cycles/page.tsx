import { BillingWorkspace } from "@/components/billing-workspace";
import { getBillingPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function BillingCyclesPage() {
  const data = await getBillingPageData();

  return <BillingWorkspace cycles={data.cycles} audits={data.audits} sessions={data.sessions} />;
}
