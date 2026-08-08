"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPENSE_TYPE_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { PersonalSummary, Member } from "./actions";

const CustomTooltip = ({ active, payload, currency }: { active?: boolean; payload?: Array<{ value: number; name: string }>; currency: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium text-foreground">
        {currency} {payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

export function PersonalDashboard({
  summary,
  members,
  currency,
  currentUserId,
}: {
  summary: PersonalSummary;
  members: Member[];
  currency: string;
  currentUserId: string;
}) {
  const userName = members.find((m) => m.user_id === currentUserId)?.full_name ?? "You";
  const balance = summary.totalPaid - summary.totalOwed;

  const chartData = Object.entries(summary.byType)
    .map(([type, amount]) => ({
      name: EXPENSE_TYPE_LABELS[type] ?? type,
      amount,
      fill: CATEGORY_COLORS[type] ?? "#a8a29e",
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="flex flex-col gap-4">
      {/* Greeting + balance */}
      <Card className="border-border shadow-sm">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <p className="text-xl font-semibold text-foreground">{userName}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 rounded-lg bg-secondary/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">You paid</p>
              <p className="text-sm font-semibold text-foreground">
                {currency} {summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex-1 rounded-lg bg-secondary/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">You owe</p>
              <p className="text-sm font-semibold text-foreground">
                {currency} {summary.totalOwed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className={`text-sm font-semibold ${balance >= 0 ? "text-green-700" : "text-destructive"}`}>
              {balance >= 0 ? "+" : ""}{currency} {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {balance >= 0 ? " (others owe you)" : " (you owe more)"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Spending by type chart */}
      {chartData.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your spending by type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip currency={currency} />} cursor={false} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {chartData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.fill }} />
                  {entry.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent expenses paid */}
      {summary.recentExpenses.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your recent expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              {summary.recentExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {EXPENSE_TYPE_LABELS[exp.type] ?? exp.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(exp.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {currency} {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.expenseCount === 0 && (
        <Card className="border-border shadow-sm">
          <CardContent className="pt-4">
            <p className="text-center text-sm text-muted-foreground">
              No expenses yet. Add your first expense to get started!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
