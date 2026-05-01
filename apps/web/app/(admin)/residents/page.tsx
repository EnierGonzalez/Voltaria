import { ModulePage } from "@/components/module-page";
import { getModulePageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ResidentsPage() {
  const data = await getModulePageData();

  return <ModulePage module="residents" data={data} />;
}
