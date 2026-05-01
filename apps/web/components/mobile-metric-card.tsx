import type { ReactNode } from "react";
import { cn } from "@voltaria/ui";

export function MobileMetricCard({
  label,
  value,
  icon,
  href,
  className
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
        {icon ? <div className="shrink-0 text-cyan">{icon}</div> : null}
      </div>
      <p className="mt-2 truncate text-base font-semibold text-foreground">{value}</p>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          "block min-w-0 overflow-hidden rounded-lg border border-border bg-panel2/64 p-4 transition hover:border-primary/50 hover:bg-panel2",
          className
        )}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={cn("min-w-0 overflow-hidden rounded-lg border border-border bg-panel2/64 p-4", className)}>
      {content}
    </div>
  );
}
