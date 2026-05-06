import { SectionCard, StatusBadge } from "@voltaria/ui";
import { createDbClientIfConfigured, loadDatabaseEnv, pingDatabase } from "@voltaria/db";
import { getDeploymentConfigStatus } from "@/lib/deployment";

loadDatabaseEnv();

export const dynamic = "force-dynamic";

export default async function DeploymentSettingsPage() {
  const config = getDeploymentConfigStatus();
  const dbReachable = await checkDatabase();

  return (
    <div className="space-y-6">
      <SectionCard
        title="Deployment readiness"
        description="Estado seguro para staging/demo en Vercel. No muestra secretos."
        action={<StatusBadge variant={config.status === "ok" && dbReachable ? "success" : "warning"}>{config.status}</StatusBadge>}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ReadinessItem label="App env" value={config.appEnv} ok={config.appEnv !== "production"} />
          <ReadinessItem label="DB connected" value={dbReachable ? "yes" : "no"} ok={dbReachable} />
          <ReadinessItem label="Demo tools" value={config.demoToolsEnabled ? "enabled" : "disabled"} ok />
          <ReadinessItem
            label="RFID hash secret"
            value={config.rfidHashSecretConfigured ? "configured" : "missing/placeholder"}
            ok={config.rfidHashSecretConfigured || config.appEnv === "development"}
          />
          <ReadinessItem
            label="RFID reader key"
            value={config.rfidReaderApiKeyConfigured ? "configured" : "missing/placeholder"}
            ok={config.rfidReaderApiKeyConfigured || config.appEnv === "development"}
          />
          <ReadinessItem
            label="Staging protection"
            value={config.stagingAccessEnabled ? "enabled" : "disabled"}
            ok={config.stagingAccessConfigured}
          />
          <ReadinessItem
            label="Vercel URL"
            value={config.vercelUrlConfigured ? "configured" : "local/not set"}
            ok
          />
        </div>
        {config.issues.length > 0 ? (
          <div className="mt-4 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
            {config.issues.join(", ")}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function ReadinessItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel2/60 p-4">
      <p className="truncate text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        <StatusBadge variant={ok ? "success" : "warning"}>{ok ? "ok" : "check"}</StatusBadge>
      </div>
    </div>
  );
}

async function checkDatabase() {
  const context = createDbClientIfConfigured();

  if (!context) {
    return false;
  }

  try {
    await pingDatabase(context.db);
    return true;
  } catch {
    return false;
  } finally {
    await context.client.end();
  }
}
