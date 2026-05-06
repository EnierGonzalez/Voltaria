import { ModulePage } from "@/components/module-page";
import { requireAnyPagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAnyPagePermission(["rules.view", "users.view", "system.health.view"], "/settings");

  return <ModulePage module="settings" />;
}
