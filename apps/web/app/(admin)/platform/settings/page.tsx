import { PlatformPlaceholder } from "@/components/platform-admin";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformSettingsPage() {
  await requirePagePermission("platform.tenants.view", "/platform/settings");

  return (
    <PlatformPlaceholder
      title="Platform settings"
      description="Configuración global SaaS. Las reglas, usuarios y billing operativos viven en cada tenant."
    />
  );
}
