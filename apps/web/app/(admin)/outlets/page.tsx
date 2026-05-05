import { getModulePageData } from "@/lib/data";
import { ModulePage } from "@/components/module-page";

export const dynamic = "force-dynamic";

export default async function OutletsPage() {
  const data = await getModulePageData();

  return <ModulePage module="outlets" data={data} />;
}
