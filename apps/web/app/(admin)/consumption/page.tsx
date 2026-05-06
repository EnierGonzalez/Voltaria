import { ModulePage } from "@/components/module-page";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ConsumptionPage() {
  await requirePagePermission("dashboard.view", "/consumption");

  return <ModulePage module="consumption" />;
}
