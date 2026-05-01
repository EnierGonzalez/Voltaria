"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { SectionCard, StatusBadge, cn } from "@voltaria/ui";
import {
  formatCurrency,
  formatDate,
  formatKwh,
  type ConsumptionPoint
} from "@voltaria/shared";

export type ConsumptionRange = "day" | "week" | "month";

const rangeLabels: Record<ConsumptionRange, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes"
};

type TooltipPayload = Array<{ payload?: ConsumptionPoint }>;

function ConsumptionTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: TooltipPayload;
}) {
  const item = payload?.[0]?.payload;

  if (!active || !item) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-panel px-3 py-2 shadow-premium">
      <p className="text-xs font-medium text-foreground">{item.label}</p>
      <p className="mt-1 text-xs text-muted">{formatKwh(item.kwh)}</p>
      <p className="text-xs text-muted">{item.sessions} sesiones</p>
    </div>
  );
}

export function ConsumptionChart({
  title = "Consumo por día",
  description = "Energía entregada por sesiones completadas",
  dataByRange,
  ranges = ["day", "week", "month"],
  compact = false
}: {
  title?: string;
  description?: string;
  dataByRange: Record<ConsumptionRange, ConsumptionPoint[]>;
  ranges?: ConsumptionRange[];
  compact?: boolean;
}) {
  const [range, setRange] = useState<ConsumptionRange>(ranges[0] ?? "day");
  const data = dataByRange[range];
  const [selected, setSelected] = useState<ConsumptionPoint>(data[0]!);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const total = useMemo(
    () =>
      data.reduce(
        (acc, item) => ({
          kwh: acc.kwh + item.kwh,
          sessions: acc.sessions + item.sessions,
          costAmount: acc.costAmount + item.costAmount
        }),
        { kwh: 0, sessions: 0, costAmount: 0 }
      ),
    [data]
  );

  return (
    <SectionCard
      title={title}
      description={description}
      action={
        <div className="flex min-w-0 rounded-md border border-border bg-panel2 p-1">
          {ranges.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setRange(item);
                setSelected(dataByRange[item][0]!);
              }}
              className={cn(
                "min-h-8 rounded px-3 text-xs font-medium text-muted transition hover:text-foreground",
                range === item && "bg-primary/16 text-cyan"
              )}
            >
              {rangeLabels[item]}
            </button>
          ))}
        </div>
      }
    >
      <div
        className={cn(
          "relative min-w-0",
          compact ? "h-[220px] md:h-56" : "h-[240px] md:h-[300px] xl:h-[320px]"
        )}
      >
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#162235" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#B8C4D9", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#B8C4D9", fontSize: 12 }}
                width={48}
              />
              <Tooltip cursor={{ fill: "rgba(31, 107, 255, 0.08)" }} content={<ConsumptionTooltip />} />
              <Bar
                dataKey="kwh"
                fill="#00C2FF"
                radius={[6, 6, 2, 2]}
                maxBarSize={compact ? 34 : 48}
                onClick={(item) => {
                  const payload = (item as { payload?: ConsumptionPoint }).payload;
                  if (payload) {
                    setSelected(payload);
                  }
                }}
                className="cursor-pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 rounded-lg border border-border bg-panel2/50" />
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Summary label={range === "day" ? "Fecha" : "Periodo"} value={formatDate(selected.date)} />
        <Summary label="kWh entregados" value={formatKwh(selected.kwh)} />
        <Summary label="Sesiones" value={selected.sessions.toString()} />
        <Summary label="Costo estimado" value={formatCurrency(selected.costAmount)} />
      </div>

      {!compact ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
          <StatusBadge variant="info">{formatKwh(total.kwh)}</StatusBadge>
          <StatusBadge variant="success">{total.sessions} sesiones</StatusBadge>
          <StatusBadge variant="warning">{formatCurrency(total.costAmount)}</StatusBadge>
        </div>
      ) : null}
    </SectionCard>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel2/58 p-2.5">
      <p className="truncate text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
