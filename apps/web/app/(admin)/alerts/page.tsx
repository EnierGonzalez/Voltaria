import { ModulePage } from "@/components/module-page";
import { getModulePageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const data = await getModulePageData();

  return <ModulePage module="alerts" data={data} />;
}
