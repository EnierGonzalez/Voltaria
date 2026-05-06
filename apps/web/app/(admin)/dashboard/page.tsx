import { AdminDashboard } from "@/components/admin-dashboard";
import { getDashboardPageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePagePermission("dashboard.view", "/dashboard");
  const data = await getDashboardPageData();

  return <AdminDashboard data={data} />;
}
