import { getModulePageData } from "@/lib/data";
import { ModulePage } from "@/components/module-page";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OutletsPage() {
  await requirePagePermission("outlets.view", "/outlets");
  const data = await getModulePageData();

  return <ModulePage module="outlets" data={data} />;
}
