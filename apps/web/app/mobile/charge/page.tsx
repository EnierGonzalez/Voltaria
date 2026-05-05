import { MobileChargeScreen } from "@/components/mobile-screens";
import { getMobileChargeData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MobileChargePage() {
  const data = await getMobileChargeData();

  return <MobileChargeScreen data={data} />;
}
