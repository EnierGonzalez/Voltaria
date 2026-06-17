"use client";

import { CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { StatusBadge, cn } from "@voltaria/ui";
import type { AlertSummary } from "@voltaria/shared";

export function AlertItem({
  alert,
  attended,
  basePath = "",
  onAttend
}: {
  alert: AlertSummary;
  attended: boolean;
  basePath?: string;
  onAttend: (id: string) => void;
}) {
  const href = alert.chargerId ? `${basePath}/chargers/${alert.chargerId}` : `${basePath}/alerts`;

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border bg-panel2/58 p-4 transition hover:border-primary/45",
        alert.severity === "critical" && !attended ? "border-danger/40" : "border-border",
        attended && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <Link href={href} className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{alert.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{alert.description}</p>
        </Link>
        <StatusBadge variant={attended ? "acknowledged" : alert.severity}>
          {attended ? "Atendida" : alert.severityLabel}
        </StatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="min-w-0 truncate">{alert.source}</span>
        <Link href={href} className="ml-auto inline-flex items-center gap-1 text-cyan hover:text-foreground">
          Abrir
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        {!attended ? (
          <button
            type="button"
            onClick={() => onAttend(alert.id)}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 text-success transition hover:bg-success/15"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Marcar como atendida
          </button>
        ) : null}
      </div>
    </div>
  );
}
