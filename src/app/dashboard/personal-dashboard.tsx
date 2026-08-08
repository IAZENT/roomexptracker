"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { EXPENSE_TYPE_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { PersonalSummary, Member } from "./actions";

const CHART_TABS = [
  { id: "overview", label: "Overview" },
  { id: "byType", label: "By type" },
  { id: "timeline", label: "Over time" },
  { id: "paidOwed", label: "Paid vs owed" },
  { id: "whoOwe", label: "Who you owe" },
] as const;

type ChartTab = (typeof CHART_TABS)[number]["id"];

const PAID_COLOR = "#d97706";
const OWED_COLOR = "#ea580c";
const PALETTE = ["#d97706", "#ea580c", "#a16207", "#92400e", "#78350f", "#451a03"];

const OverviewTooltip = ({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; currency: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">
        {currency} {payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

const TimelineTooltip = ({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string; currency: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: p.dataKey === "paid" ? PAID_COLOR : OWED_COLOR }}>
          {p.dataKey === "paid" ? "You paid" : "You owe"}: {currency} {p.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      ))}
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

  const [activeTab, setActiveTab] = useState<ChartTab>("overview");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", checkScroll); };
  }, [checkScroll, activeTab]);

  const scrollTabs = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" });
  };

  // Chart data
  const byTypeData = Object.entries(summary.byType)
    .map(([type, amount]) => ({
      name: EXPENSE_TYPE_LABELS[type] ?? type,
      amount,
      fill: CATEGORY_COLORS[type] ?? "#a8a29e",
    }))
    .sort((a, b) => b.amount - a.amount);

  const byTypeOwedData = Object.entries(summary.byTypeOwed)
    .map(([type, amount]) => ({
      name: EXPENSE_TYPE_LABELS[type] ?? type,
      amount,
      fill: CATEGORY_COLORS[type] ?? "#a8a29e",
    }))
    .sort((a, b) => b.amount - a.amount);

  const paidOwedData = [
    { name: "You paid", value: summary.totalPaid, fill: PAID_COLOR },
    { name: "You owe", value: summary.totalOwed, fill: OWED_COLOR },
  ].filter((d) => d.value > 0);

  const payerData = summary.topPayerBreakdown.map((p, i) => ({
    ...p,
    fill: PALETTE[i % PALETTE.length],
  }));

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

      {/* Tab bar */}
      <div className="relative">
        {showLeft && (
          <button onClick={() => scrollTabs("left")} className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow-sm backdrop-blur-sm">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <div ref={scrollRef} className="no-scrollbar flex gap-1 overflow-x-auto px-1 py-1" style={{ scrollbarWidth: "none" }}>
          {CHART_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {showRight && (
          <button onClick={() => scrollTabs("right")} className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow-sm backdrop-blur-sm">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-4">
          {/* Stacked bar: paid vs owed by type */}
          {byTypeData.length > 0 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Spending breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byTypeData} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<OverviewTooltip currency={currency} />} cursor={false} />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {byTypeData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {byTypeData.map((entry) => {
                    const pct = summary.totalPaid > 0 ? ((entry.amount / summary.totalPaid) * 100).toFixed(1) : "0";
                    return (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.fill }} />
                        {entry.name} ({pct}%)
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Donut: paid vs owed */}
          {paidOwedData.length > 0 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Paid vs Owed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="h-[160px] w-[160px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paidOwedData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {paidOwedData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-3">
                    {paidOwedData.map((entry) => {
                      const total = summary.totalPaid + summary.totalOwed;
                      const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
                      return (
                        <div key={entry.name}>
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: entry.fill }} />
                            <span className="text-sm text-muted-foreground">{entry.name}</span>
                          </div>
                          <p className="ml-5 text-sm font-semibold text-foreground">
                            {currency} {entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className="ml-5 text-xs text-muted-foreground">{pct}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* By type detail */}
      {activeTab === "byType" && (
        <div className="flex flex-col gap-4">
          {byTypeData.length > 0 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">What you paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byTypeData} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<OverviewTooltip currency={currency} />} cursor={false} />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {byTypeData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {byTypeData.map((entry) => {
                    const pct = summary.totalPaid > 0 ? ((entry.amount / summary.totalPaid) * 100).toFixed(1) : "0";
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.fill }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="font-medium text-foreground">
                          {currency} {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {byTypeOwedData.length > 0 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">What you owe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byTypeOwedData} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<OverviewTooltip currency={currency} />} cursor={false} />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {byTypeOwedData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {byTypeOwedData.map((entry) => {
                    const pct = summary.totalOwed > 0 ? ((entry.amount / summary.totalOwed) * 100).toFixed(1) : "0";
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.fill }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="font-medium text-foreground">
                          {currency} {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Over time */}
      {activeTab === "timeline" && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spending over time</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.dailySpending.length > 0 ? (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.dailySpending} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PAID_COLOR} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={PAID_COLOR} stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gradOwed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={OWED_COLOR} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={OWED_COLOR} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => {
                        const d = new Date(v + "T00:00:00");
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${currency}${v}`}
                    />
                    <Tooltip content={<TimelineTooltip currency={currency} />} />
                    <Area
                      type="monotone"
                      dataKey="paid"
                      stroke={PAID_COLOR}
                      strokeWidth={2}
                      fill="url(#gradPaid)"
                      dot={{ r: 3, fill: PAID_COLOR }}
                      activeDot={{ r: 5 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="owed"
                      stroke={OWED_COLOR}
                      strokeWidth={2}
                      fill="url(#gradOwed)"
                      dot={{ r: 3, fill: OWED_COLOR }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No spending data for this period.</p>
            )}
            <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PAID_COLOR }} />
                You paid
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: OWED_COLOR }} />
                You owe
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paid vs Owed detail */}
      {activeTab === "paidOwed" && (
        <div className="flex flex-col gap-4">
          {paidOwedData.length > 0 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Paid vs Owed split</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="h-[180px] w-[180px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paidOwedData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {paidOwedData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-4">
                    {paidOwedData.map((entry) => {
                      const total = summary.totalPaid + summary.totalOwed;
                      const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
                      return (
                        <div key={entry.name}>
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: entry.fill }} />
                            <span className="text-sm text-muted-foreground">{entry.name}</span>
                          </div>
                          <p className="ml-5 text-lg font-semibold text-foreground">
                            {currency} {entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className="ml-5 text-xs text-muted-foreground">{pct}% of total</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per type comparison */}
          {Object.keys(summary.byType).length > 0 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Paid vs Owed by type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.keys(summary.byType).map((type) => ({
                        name: EXPENSE_TYPE_LABELS[type] ?? type,
                        paid: summary.byType[type] ?? 0,
                        owed: summary.byTypeOwed[type] ?? 0,
                      }))}
                      margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<TimelineTooltip currency={currency} />} />
                      <Bar dataKey="paid" fill={PAID_COLOR} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="owed" fill={OWED_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PAID_COLOR }} />
                    You paid
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: OWED_COLOR }} />
                    You owe
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Who you owe */}
      {activeTab === "whoOwe" && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Who paid for your expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {payerData.length > 0 ? (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payerData} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<OverviewTooltip currency={currency} />} cursor={false} />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {payerData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {payerData.map((entry) => {
                    const pct = summary.totalOwed > 0 ? ((entry.amount / summary.totalOwed) * 100).toFixed(1) : "0";
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.fill }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="font-medium text-foreground">
                          {currency} {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                You haven&apos;t owed anyone yet. All expenses are self-paid.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Household members */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Household members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {(m.full_name ?? "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {m.full_name ?? "Unknown"}
                      {m.user_id === currentUserId && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent expenses */}
      {summary.recentExpenses.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent expenses</CardTitle>
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
