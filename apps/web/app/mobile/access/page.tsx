import { MobileAccessScreen } from "@/components/mobile-screens";
import { getMobileAccessData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MobileAccessPage() {
  const data = await getMobileAccessData();

  return <MobileAccessScreen data={data} />;
}
