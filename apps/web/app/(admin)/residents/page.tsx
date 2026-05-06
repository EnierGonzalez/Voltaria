import { ModulePage } from "@/components/module-page";
import { getModulePageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ResidentsPage() {
  await requirePagePermission("residents.view", "/residents");
  const data = await getModulePageData();

  return <ModulePage module="residents" data={data} />;
}
