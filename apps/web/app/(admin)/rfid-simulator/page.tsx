import { redirectLegacyTenantRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RfidSimulatorPage() {
  await redirectLegacyTenantRoute("rfid-simulator");
}
