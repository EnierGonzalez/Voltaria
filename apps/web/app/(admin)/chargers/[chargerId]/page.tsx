import { notFound } from "next/navigation";
import { ChargerDetail } from "@/components/charger-detail";
import { ocppLogs, recentSessions, towerChargers } from "@voltaria/shared";

export default async function ChargerDetailPage({
  params
}: {
  params: Promise<{ chargerId: string }>;
}) {
  const { chargerId } = await params;
  const charger = towerChargers.find((item) => item.id === chargerId);

  if (!charger) {
    notFound();
  }

  const sessions = recentSessions.filter((session) => session.chargerId === charger.id);
  const currentSession = charger.currentSessionId
    ? recentSessions.find((session) => session.id === charger.currentSessionId)
    : undefined;
  const logs = ocppLogs.filter((log) => log.chargerId === charger.id);

  return (
    <ChargerDetail
      charger={charger}
      sessions={sessions}
      logs={logs}
      {...(currentSession ? { currentSession } : {})}
    />
  );
}
