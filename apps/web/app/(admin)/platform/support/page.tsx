import { PlatformPlaceholder } from "@/components/platform-admin";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformSupportPage() {
  await requirePagePermission("system.health.view", "/platform/support");

  return (
    <PlatformPlaceholder
      title="Support"
      description="Vista global futura para soporte operativo cross-tenant."
    />
  );
}
