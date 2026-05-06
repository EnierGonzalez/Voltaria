import { notFound } from "next/navigation";
import { RfidSimulator } from "@/components/rfid-simulator";
import { isDemoToolsEnabled } from "@/lib/deployment";
import { getRfidSimulatorPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RfidSimulatorPage() {
  if (!isDemoToolsEnabled()) {
    notFound();
  }

  const data = await getRfidSimulatorPageData();

  return <RfidSimulator accessDevices={data.accessDevices} outlets={data.outlets} />;
}
