import { ModulePage } from "@/components/module-page";
import { getModulePageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ChargersPage() {
  const data = await getModulePageData();

  return <ModulePage module="chargers" data={data} />;
}
