import { notFound } from "next/navigation";
import { ResidentDetail } from "@/components/resident-detail";
import { getResidentDetailPageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ResidentDetailPage({
  params
}: {
  params: Promise<{ residentId: string }>;
}) {
  await requirePagePermission("residents.view", "/residents");
  const { residentId } = await params;
  const data = await getResidentDetailPageData(residentId);

  if (!data.resident) {
    notFound();
  }

  return (
    <ResidentDetail
      resident={data.resident}
      sessions={data.sessions}
      credentials={data.credentials}
      credentialEvents={data.credentialEvents}
      accessDevices={data.accessDevices}
      accessRule={data.accessRule}
    />
  );
}
