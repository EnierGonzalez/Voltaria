import { ModulePage } from "@/components/module-page";
import { getModulePageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  await requirePagePermission("alerts.view", "/alerts");
  const data = await getModulePageData();

  return <ModulePage module="alerts" data={data} />;
}
