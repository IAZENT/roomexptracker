"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { BalanceHistoryPoint } from "./actions";

const COLORS = ["#c2785c", "#6b8f71", "#8b7355", "#a0522d", "#708090", "#b8860b"];

export function BalanceHistoryChart({
  data,
  currency,
}: {
  data: BalanceHistoryPoint[];
  currency: string;
}) {
  // Collect unique member IDs
  const memberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const point of data) {
      for (const userId of Object.keys(point.members)) {
        ids.add(userId);
      }
    }
    return Array.from(ids);
  }, [data]);

  // Build chart data
  const chartData = useMemo(() => {
    return data.map((point) => {
      const entry: Record<string, string | number> = { month: point.cycleLabel };
      for (const userId of memberIds) {
        const memberData = point.members[userId];
        entry[memberData?.name ?? userId] = memberData?.balance ?? 0;
      }
      return entry;
    });
  }, [data, memberIds]);

  // Build name map for legend
  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const point of data) {
      for (const [userId, memberData] of Object.entries(point.members)) {
        map[userId] = memberData.name;
      }
    }
    return map;
  }, [data]);

  const names = memberIds.map((id) => nameMap[id] ?? id);

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No balance history yet. Close some cycles to see trends.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v: number) => `${currency}${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value) => [`${currency}${Number(value).toFixed(2)}`, undefined]}
          />
          <Legend />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          {names.map((name, i) => (
            <Bar
              key={name}
              dataKey={name}
              fill={COLORS[i % COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
