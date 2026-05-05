import { notFound } from "next/navigation";
import { MobileOutletDetailScreen } from "@/components/mobile-outlets";
import { getOutletByPublicCodeData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MobileOutletPublicCodePage({
  params
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const { publicCode } = await params;
  const data = await getOutletByPublicCodeData(publicCode);

  if (!data.outlet) {
    notFound();
  }

  return <MobileOutletDetailScreen data={data} outlet={data.outlet} />;
}
