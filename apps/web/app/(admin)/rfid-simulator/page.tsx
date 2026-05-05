import { RfidSimulator } from "@/components/rfid-simulator";
import { getRfidSimulatorPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RfidSimulatorPage() {
  const data = await getRfidSimulatorPageData();

  return <RfidSimulator accessDevices={data.accessDevices} outlets={data.outlets} />;
}
