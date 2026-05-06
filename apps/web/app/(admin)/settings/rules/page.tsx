import { OperationalRulesSettings } from "@/components/operational-rules-settings";
import { getRulesSettingsPageData } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RulesSettingsPage() {
  await requirePagePermission("rules.view", "/settings/rules");
  const data = await getRulesSettingsPageData();

  return <OperationalRulesSettings rule={data.rule} schedules={data.schedules} />;
}
