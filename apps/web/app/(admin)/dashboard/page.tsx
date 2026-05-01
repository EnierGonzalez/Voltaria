import { AdminDashboard } from "@/components/admin-dashboard";
import { getDashboardPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardPageData();

  return <AdminDashboard data={data} />;
}
