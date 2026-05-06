import { notFound } from "next/navigation";
import { RfidSimulator } from "@/components/rfid-simulator";
import { isDemoToolsEnabled } from "@/lib/deployment";
import { getRfidSimulatorPageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RfidSimulatorPage() {
  await requirePagePermission("rfid_simulator.use", "/rfid-simulator");

  if (!isDemoToolsEnabled()) {
    notFound();
  }

  const data = await getRfidSimulatorPageData();

  return <RfidSimulator accessDevices={data.accessDevices} outlets={data.outlets} />;
}
