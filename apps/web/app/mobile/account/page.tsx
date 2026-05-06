import { MobileAccountScreen } from "@/components/mobile-screens";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MobileAccountPage() {
  const user = await requireUser("/mobile/account");

  return <MobileAccountScreen currentUser={user} />;
}
