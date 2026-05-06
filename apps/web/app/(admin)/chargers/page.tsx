import { ModulePage } from "@/components/module-page";
import { getModulePageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChargersPage() {
  await requirePagePermission("outlets.view", "/chargers");
  const data = await getModulePageData();

  return <ModulePage module="chargers" data={data} />;
}
