import { notFound } from "next/navigation";
import { BillingCycleDetail } from "@/components/billing-cycle-detail";
import { getBillingCycleDetailPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function BillingCycleDetailPage({
  params
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const data = await getBillingCycleDetailPageData(cycleId);

  if (!data.detail) {
    notFound();
  }

  return <BillingCycleDetail detail={data.detail} />;
}
