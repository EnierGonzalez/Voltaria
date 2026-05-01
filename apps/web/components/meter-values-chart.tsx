"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatKwh, formatPower, type MeterValuePoint } from "@voltaria/shared";

type TooltipPayload = Array<{ payload?: MeterValuePoint }>;

function MeterTooltip({
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
      <p className="mt-1 text-xs text-muted">{formatKwh(item.energyKwh)}</p>
      <p className="text-xs text-muted">{formatPower(item.powerKw)}</p>
    </div>
  );
}

export function MeterValuesChart({ data }: { data: MeterValuePoint[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="h-72 min-w-0">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
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
            <Tooltip cursor={{ stroke: "#1F6BFF", strokeDasharray: "4 4" }} content={<MeterTooltip />} />
            <Line
              type="monotone"
              dataKey="powerKw"
              stroke="#00C2FF"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#00C2FF", stroke: "#060B14", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "#00E38C" }}
            />
            <Line
              type="monotone"
              dataKey="energyKwh"
              stroke="#00E38C"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full rounded-lg border border-border bg-panel2/50" />
      )}
    </div>
  );
}
