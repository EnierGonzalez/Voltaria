import { ModulePage } from "@/components/module-page";
import { getModulePageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  await requirePagePermission("sessions.view", "/sessions");
  const data = await getModulePageData();

  return <ModulePage module="sessions" data={data} />;
}
