"use client";

import { FileSearch } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge, cn } from "@voltaria/ui";
import {
  formatCurrency,
  formatDuration,
  formatKwh,
  type ChargingSessionSummary
} from "@voltaria/shared";
import { EmptyState } from "./empty-state";

type FilterKey = "all" | "active" | "completed" | "failed";

const filterLabels: Record<FilterKey, string> = {
  all: "Todas",
  active: "Activas",
  completed: "Finalizadas",
  failed: "Fallidas"
};

export function DashboardRecentSessions({
  sessions,
  basePath = ""
}: {
  sessions: ChargingSessionSummary[];
  basePath?: string;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(
    () =>
      sessions.filter((session) => {
        if (filter === "all") {
          return true;
        }

        if (filter === "failed") {
          return session.status === "failed" || session.status === "interrupted";
        }

        return session.status === filter;
      }),
    [filter, sessions]
  );

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {(Object.keys(filterLabels) as FilterKey[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "min-h-8 rounded-md border border-border bg-panel2 px-2.5 text-xs font-medium text-muted transition hover:text-foreground",
              filter === item && "border-primary/40 bg-primary/15 text-cyan"
            )}
          >
            {filterLabels[item]}
          </button>
        ))}
        <Link
          href={`${basePath}/sessions`}
          className="ml-auto min-h-8 rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-xs font-medium text-cyan transition hover:border-primary/50 hover:text-foreground"
        >
          Ver todas
        </Link>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin sesiones"
          description="No hay sesiones mock para el filtro seleccionado."
          icon={<FileSearch className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <>
          <div className="hidden min-w-0 overflow-hidden rounded-lg border border-border md:block">
            <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_96px_112px] bg-panel2 px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted">
              <span className="truncate">Residente</span>
              <span className="truncate">Cargador</span>
              <span className="truncate">Energía</span>
              <span className="truncate">Estado</span>
            </div>
            <div className="divide-y divide-border bg-panel/60">
              {filtered.map((session) => (
                <Link
                  key={session.id}
                  href={`${basePath}/sessions/${session.id}`}
                  className="grid min-w-0 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_96px_112px] items-center gap-0 px-3 py-3 text-sm transition hover:bg-panel2/72"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-medium text-foreground">{session.residentName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">Depto {session.apartmentNumber}</p>
                  </div>
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-muted">{session.chargerCode}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{session.chargerLocation}</p>
                  </div>
                  <p className="truncate pr-3 font-medium text-foreground">{formatKwh(session.deliveredKwh)}</p>
                  <div className="min-w-0">
                    <StatusBadge variant={session.status}>{session.statusLabel}</StatusBadge>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((session) => (
              <Link
                key={session.id}
                href={`${basePath}/sessions/${session.id}`}
                className="block min-w-0 overflow-hidden rounded-lg border border-border bg-panel2/64 p-3 transition hover:border-primary/50 hover:bg-panel2"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{session.residentName}</p>
                    <p className="mt-1 truncate text-xs text-muted">
                      Depto {session.apartmentNumber} · {session.chargerCode}
                    </p>
                  </div>
                  <StatusBadge variant={session.status}>{session.statusLabel}</StatusBadge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Mini label="Energía" value={formatKwh(session.deliveredKwh)} />
                  <Mini label="Tiempo" value={formatDuration(session.durationMinutes)} />
                  <Mini label="Costo" value={formatCurrency(session.costAmount)} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-panel/70 p-2">
      <p className="truncate text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
