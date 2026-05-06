import { UserManagement } from "@/components/user-management";
import { getUsersSettingsPageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  await requirePagePermission("users.view", "/settings/users");
  const data = await getUsersSettingsPageData();

  return (
    <UserManagement
      users={data.users}
      residents={data.residents}
      propertyId={data.propertyId}
    />
  );
}
