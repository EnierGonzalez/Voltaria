import { notFound } from "next/navigation";
import { SessionDetail } from "@/components/session-detail";
import { meterValueSeries, ocppLogs, recentSessions, sessionEvents } from "@voltaria/shared";

export default async function SessionDetailPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = recentSessions.find((item) => item.id === sessionId);

  if (!session) {
    notFound();
  }

  return (
    <SessionDetail
      session={session}
      events={sessionEvents.filter((event) => event.sessionId === session.id)}
      meterValues={meterValueSeries[session.id] ?? []}
      logs={ocppLogs.filter((log) => log.sessionId === session.id)}
    />
  );
}
