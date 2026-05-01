"use client";

import { ArrowUpDown, FileSearch } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge, cn } from "@voltaria/ui";
import {
  formatCurrency,
  formatDuration,
  formatKwh,
  formatPower,
  type ChargingSessionSummary,
  type SessionStatus
} from "@voltaria/shared";
import { EmptyState } from "./empty-state";

type FilterKey = "all" | "active" | "completed" | "failed";
type SortKey = "residentName" | "apartmentNumber" | "chargerCode" | "deliveredKwh" | "durationMinutes" | "costAmount";

const filterLabels: Record<FilterKey, string> = {
  all: "Todas",
  active: "Activas",
  completed: "Finalizadas",
  failed: "Fallidas"
};

export function SessionTable({
  sessions,
  initialFilter
}: {
  sessions: ChargingSessionSummary[];
  initialFilter?: FilterKey | undefined;
}) {
  const [filter, setFilter] = useState<FilterKey>(initialFilter ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>("deliveredKwh");
  const [ascending, setAscending] = useState(false);

  useEffect(() => {
    if (initialFilter) {
      return;
    }

    const urlFilter = normalizeStatus(new URLSearchParams(window.location.search).get("status"));
    if (urlFilter) {
      setFilter(urlFilter);
    }
  }, [initialFilter]);

  const filtered = useMemo(() => {
    const byStatus = sessions.filter((session) => {
      if (filter === "all") {
        return true;
      }

      if (filter === "failed") {
        return session.status === "failed" || session.status === "interrupted";
      }

      return session.status === filter;
    });

    return [...byStatus].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      const result =
        typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), "es");

      return ascending ? result : -result;
    });
  }, [ascending, filter, sessions, sortKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(filterLabels) as FilterKey[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "min-h-9 rounded-md border border-border bg-panel2 px-3 text-sm font-medium text-muted transition hover:text-foreground",
              filter === item && "border-primary/40 bg-primary/15 text-cyan"
            )}
          >
            {filterLabels[item]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin sesiones"
          description="No hay sesiones mock para el filtro seleccionado."
          icon={<FileSearch className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-panel2 text-xs uppercase tracking-[0.16em] text-muted">
              <tr>
                <SortableHeader label="Residente" sortKey="residentName" activeKey={sortKey} onSort={handleSort} />
                <SortableHeader label="Depto" sortKey="apartmentNumber" activeKey={sortKey} onSort={handleSort} />
                <SortableHeader label="Cargador" sortKey="chargerCode" activeKey={sortKey} onSort={handleSort} />
                <SortableHeader label="Energía" sortKey="deliveredKwh" activeKey={sortKey} onSort={handleSort} />
                <SortableHeader label="Tiempo" sortKey="durationMinutes" activeKey={sortKey} onSort={handleSort} />
                <th className="px-4 py-3 font-medium">Potencia</th>
                <SortableHeader label="Costo" sortKey="costAmount" activeKey={sortKey} onSort={handleSort} />
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-panel/60">
              {filtered.map((session) => (
                <tr key={session.id} className="transition hover:bg-panel2/70">
                  <td className="px-4 py-3">
                    <Link href={`/sessions/${session.id}`} className="block min-w-0 truncate text-foreground">
                      {session.residentName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{session.apartmentNumber}</td>
                  <td className="px-4 py-3 text-muted">{session.chargerCode}</td>
                  <td className="px-4 py-3 text-foreground">{formatKwh(session.deliveredKwh)}</td>
                  <td className="px-4 py-3 text-muted">{formatDuration(session.durationMinutes)}</td>
                  <td className="px-4 py-3 text-muted">{formatPower(session.powerKw)}</td>
                  <td className="px-4 py-3 text-foreground">{formatCurrency(session.costAmount)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={session.status}>{session.statusLabel}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setAscending((value) => !value);
      return;
    }

    setSortKey(nextKey);
    setAscending(true);
  }
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  onSort
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-left transition hover:text-foreground",
          activeKey === sortKey && "text-cyan"
        )}
      >
        {label}
        <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </th>
  );
}

function normalizeStatus(status: string | null): FilterKey | null {
  if (!status) {
    return null;
  }

  if (status === "active" || status === "completed" || status === "failed") {
      return status satisfies FilterKey & SessionStatus;
  }

  return null;
}
