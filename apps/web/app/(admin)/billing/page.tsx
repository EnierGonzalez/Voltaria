import { ModulePage } from "@/components/module-page";
import { getModulePageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const data = await getModulePageData();

  return <ModulePage module="billing" data={data} />;
}
