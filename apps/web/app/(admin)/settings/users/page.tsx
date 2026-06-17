import { redirectLegacyTenantRoute } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  await redirectLegacyTenantRoute("settings/users");
}
