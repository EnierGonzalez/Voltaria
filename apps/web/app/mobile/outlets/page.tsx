import { MobileOutletsScreen } from "@/components/mobile-outlets";
import { getOutletsPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MobileOutletsPage() {
  const data = await getOutletsPageData();

  return <MobileOutletsScreen data={data} />;
}
