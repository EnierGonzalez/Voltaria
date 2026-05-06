import { ModulePage } from "@/components/module-page";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requirePagePermission("reports.view", "/reports");

  return <ModulePage module="reports" />;
}
