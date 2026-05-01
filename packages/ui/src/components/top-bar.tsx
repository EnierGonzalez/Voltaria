import type { ReactNode } from "react";

export function TopBar({
  title,
  subtitle,
  propertyName,
  actions
}: {
  title: string;
  subtitle?: string | undefined;
  propertyName?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="flex min-h-16 flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-normal text-foreground">{title}</h1>
          {propertyName ? (
            <span className="rounded-md border border-cyan/30 bg-cyan/10 px-2 py-1 text-xs font-medium text-cyan">
              {propertyName}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
