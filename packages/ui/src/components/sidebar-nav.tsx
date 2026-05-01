import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type SidebarItem = {
  href: string;
  label: string;
  icon?: ReactNode | undefined;
  active?: boolean | undefined;
  badge?: string | undefined;
};

export function SidebarNav({
  brand,
  items,
  footerLabel,
  footerMeta
}: {
  brand: {
    name: string;
    subtitle?: string;
  };
  items: SidebarItem[];
  footerLabel?: string | undefined;
  footerMeta?: string | undefined;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan/40 bg-primary/12 text-sm font-bold text-cyan">
            V
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">{brand.name}</p>
            {brand.subtitle ? <p className="text-xs text-muted">{brand.subtitle}</p> : null}
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={cn(
              "group flex min-h-11 items-center justify-between rounded-md px-3 text-sm font-medium text-muted transition",
              "hover:bg-panel2 hover:text-foreground",
              item.active && "border border-primary/35 bg-primary/12 text-foreground shadow-[inset_3px_0_0_#00C2FF]"
            )}
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "text-muted transition group-hover:text-cyan",
                  item.active && "text-cyan"
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </span>
            {item.badge ? (
              <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs text-warning">
                {item.badge}
              </span>
            ) : null}
          </a>
        ))}
      </nav>
      <div className="border-t border-border p-4">
        <div className="rounded-lg border border-border bg-panel2/70 p-3">
          <p className="text-sm font-medium text-foreground">{footerLabel}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">{footerMeta}</p>
        </div>
      </div>
    </div>
  );
}
