import { PlatformPlaceholder } from "@/components/platform-admin";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformSystemPage() {
  await requirePagePermission("system.health.view", "/platform/system");

  return (
    <PlatformPlaceholder
      title="System health"
      description="Estado global futuro de workers, gateways y servicios compartidos."
    />
  );
}
