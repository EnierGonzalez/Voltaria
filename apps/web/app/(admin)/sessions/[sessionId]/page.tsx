import { notFound } from "next/navigation";
import { SessionDetail } from "@/components/session-detail";
import { getSessionDetailPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await getSessionDetailPageData(sessionId);

  if (!data.session) {
    notFound();
  }

  return (
    <SessionDetail
      session={data.session}
      events={data.events}
      meterValues={data.meterValues}
      logs={data.logs}
      commands={data.commands}
      ruleEvaluations={data.ruleEvaluations}
      authorizationAttempts={data.authorizationAttempts}
      audit={data.audit}
    />
  );
}
