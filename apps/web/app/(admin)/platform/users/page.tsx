import { PlatformPlaceholder } from "@/components/platform-admin";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlatformUsersPage() {
  await requirePagePermission("platform.tenants.view", "/platform/users");

  return (
    <PlatformPlaceholder
      title="Platform users"
      description="Administración global futura de soporte, owners SaaS y cuentas de servicio."
    />
  );
}
