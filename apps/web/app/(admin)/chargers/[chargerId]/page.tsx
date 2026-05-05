import { notFound } from "next/navigation";
import { ChargerDetail } from "@/components/charger-detail";
import { getChargerDetailPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ChargerDetailPage({
  params
}: {
  params: Promise<{ chargerId: string }>;
}) {
  const { chargerId } = await params;
  const data = await getChargerDetailPageData(chargerId);

  if (!data.charger) {
    notFound();
  }

  return (
    <ChargerDetail
      charger={data.charger}
      sessions={data.sessions}
      logs={data.logs}
      commands={data.commands}
      {...(data.currentSession ? { currentSession: data.currentSession } : {})}
    />
  );
}
