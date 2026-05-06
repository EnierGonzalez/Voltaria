import { AuditWorkspace } from "@/components/audit-workspace";
import { getAuditPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const data = await getAuditPageData();

  return <AuditWorkspace audits={data.audits} />;
}
