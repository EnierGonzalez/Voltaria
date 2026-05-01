import type { ReactNode } from "react";

export function AppShell({
  sidebar,
  topbar,
  children
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-panel/94 backdrop-blur lg:block">
          {sidebar}
        </aside>
        <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
          <header className="sticky top-0 z-20 border-b border-border bg-background/88 backdrop-blur">
            {topbar}
          </header>
          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
