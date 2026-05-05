import { OperationalRulesSettings } from "@/components/operational-rules-settings";
import { getRulesSettingsPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RulesSettingsPage() {
  const data = await getRulesSettingsPageData();

  return <OperationalRulesSettings rule={data.rule} schedules={data.schedules} />;
}
