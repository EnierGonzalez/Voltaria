import { MoreHorizontal, PlugZap, ScrollText, SquareArrowOutUpRight, Zap } from "lucide-react";
import Link from "next/link";
import { StatusBadge, cn } from "@voltaria/ui";
import { formatPower, type ChargerSummary } from "@voltaria/shared";

export function ChargerStatusCard({
  charger,
  compact = false
}: {
  charger: ChargerSummary;
  compact?: boolean;
}) {
  const faulted = charger.status === "faulted";

  return (
    <Link
      href={`/chargers/${charger.id}`}
      className={cn(
        "group block min-w-0 overflow-hidden rounded-lg border bg-panel2/58 p-4 transition hover:-translate-y-0.5 hover:border-primary/55 hover:bg-panel2",
        faulted ? "border-danger/45 shadow-[0_0_0_1px_rgba(255,91,110,0.12)]" : "border-border",
        compact && "p-3"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-panel",
              faulted ? "border-danger/35 text-danger" : "border-border text-cyan"
            )}
          >
            <PlugZap className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{charger.name}</p>
            <p className="mt-1 truncate text-xs text-muted">{charger.location}</p>
          </div>
        </div>
        <StatusBadge variant={charger.status}>{charger.statusLabel}</StatusBadge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini label="Conectores" value={charger.connectors.toString()} />
        <Mini label="Potencia" value={formatPower(charger.maxPowerKw)} />
        <Mini label="OCPP" value={charger.ocppVersion} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <QuickAction icon={<SquareArrowOutUpRight className="h-3.5 w-3.5" />} label="Ver detalle" />
        <QuickAction icon={<Zap className="h-3.5 w-3.5" />} label="Ver sesiones" />
        <QuickAction icon={<ScrollText className="h-3.5 w-3.5" />} label="Logs OCPP" />
        {charger.status === "charging" && charger.currentSessionId ? (
          <span className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-success">
            Ver sesión
          </span>
        ) : null}
        <span className="ml-auto text-muted opacity-0 transition group-hover:opacity-100">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-panel/60 p-2">
      <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}

function QuickAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1 rounded-md border border-border bg-panel/70 px-2 text-muted transition group-hover:text-foreground">
      {icon}
      {label}
    </span>
  );
}
