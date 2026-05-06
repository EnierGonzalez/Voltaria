import { AuditWorkspace } from "@/components/audit-workspace";
import { getAuditPageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePagePermission("audit.view", "/audit");
  const data = await getAuditPageData();

  return <AuditWorkspace audits={data.audits} />;
}
