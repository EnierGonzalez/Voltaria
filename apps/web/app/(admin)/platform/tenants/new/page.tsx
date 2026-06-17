import { TenantProvisioningForm } from "@/components/platform-admin";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewPlatformTenantPage() {
  await requirePagePermission("platform.tenants.manage", "/platform/tenants/new");

  return <TenantProvisioningForm />;
}
