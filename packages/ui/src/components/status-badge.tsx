import { cn } from "../lib/cn";
import type { ReactNode } from "react";

export type StatusVariant =
  | "available"
  | "charging"
  | "offline"
  | "faulted"
  | "reserved"
  | "pending_start"
  | "active"
  | "completed"
  | "interrupted"
  | "failed"
  | "acknowledged"
  | "paid"
  | "pending"
  | "success"
  | "warning"
  | "critical"
  | "info";

const variantClasses: Record<StatusVariant, string> = {
  available: "border-success/30 bg-success/10 text-success",
  charging: "border-cyan/30 bg-cyan/10 text-cyan",
  offline: "border-muted/20 bg-muted/10 text-muted",
  faulted: "border-danger/30 bg-danger/10 text-danger",
  reserved: "border-primary/30 bg-primary/10 text-primary",
  pending_start: "border-warning/30 bg-warning/10 text-warning",
  active: "border-cyan/30 bg-cyan/10 text-cyan",
  completed: "border-success/30 bg-success/10 text-success",
  interrupted: "border-warning/30 bg-warning/10 text-warning",
  failed: "border-danger/30 bg-danger/10 text-danger",
  acknowledged: "border-muted/25 bg-muted/10 text-muted",
  paid: "border-success/30 bg-success/10 text-success",
  pending: "border-warning/30 bg-warning/10 text-warning",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  critical: "border-danger/30 bg-danger/10 text-danger",
  info: "border-primary/30 bg-primary/10 text-primary"
};

export function StatusBadge({
  variant = "info",
  children,
  className
}: {
  variant?: StatusVariant;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md border px-2.5 py-1 text-xs font-medium capitalize",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
