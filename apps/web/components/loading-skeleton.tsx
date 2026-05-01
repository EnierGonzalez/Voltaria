import { cn } from "@voltaria/ui";

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md border border-border bg-panel2/60",
        className
      )}
    />
  );
}
