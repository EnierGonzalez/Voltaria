import { AuditWorkspace } from "@/components/audit-workspace";
import { getAuditPageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportsAuditPage() {
  await requirePagePermission("audit.view", "/reports/audit");
  const data = await getAuditPageData();

  return <AuditWorkspace audits={data.audits} />;
}
