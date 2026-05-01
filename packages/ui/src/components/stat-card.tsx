import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type Tone = "primary" | "cyan" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  primary: "border-primary/28 text-primary bg-primary/10",
  cyan: "border-cyan/28 text-cyan bg-cyan/10",
  success: "border-success/28 text-success bg-success/10",
  warning: "border-warning/28 text-warning bg-warning/10",
  danger: "border-danger/28 text-danger bg-danger/10"
};

export function StatCard({
  title,
  value,
  delta,
  icon,
  tone = "primary"
}: {
  title: string;
  value: string;
  delta?: string | undefined;
  icon?: ReactNode | undefined;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-panel/86 p-4 shadow-premium">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-[0.16em] text-muted">{title}</p>
          <p className="mt-3 truncate text-2xl font-semibold tracking-normal text-foreground">{value}</p>
        </div>
        {icon ? (
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md border", toneClasses[tone])}>
            {icon}
          </div>
        ) : null}
      </div>
      {delta ? <p className="mt-4 truncate text-sm text-muted">{delta}</p> : null}
    </div>
  );
}
