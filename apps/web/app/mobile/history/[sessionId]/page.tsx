import { MobileSessionDetailScreen } from "@/components/mobile-screens";

export default async function MobileSessionDetailPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <MobileSessionDetailScreen sessionId={sessionId} />;
}
