"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EXPENSE_TYPE_LABELS, CATEGORY_COLORS, MEMBER_COLORS } from "@/lib/constants";
import type { CycleHistory, ExpenseWithTimestamp, ExpenseSummary, Member } from "./actions";

const CHART_TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "category", label: "By category" },
  { id: "payer", label: "Who paid" },
  { id: "share", label: "Per person" },
  { id: "fixedVsVar", label: "Fixed vs variable" },
] as const;

type ChartTab = (typeof CHART_TABS)[number]["id"];

type ViewMode = "monthly" | "weekly" | "daily";

const tooltipStyle = {
  backgroundColor: "oklch(0.995 0.003 75)",
  border: "1px solid oklch(0.91 0.005 70)",
  borderRadius: "8px",
  fontSize: "12px",
};

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()} W${String(weekNum).padStart(2, "0")}`;
}

function getDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- Timeline Line Chart ---

function TimelineChart({
  history,
  timeline,
  currency,
}: {
  history: CycleHistory[];
  timeline: ExpenseWithTimestamp[];
  currency: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  const { chartData, allTypes } = useMemo(() => {
    if (viewMode === "monthly") {
      const types = new Set<string>();
      for (const h of history) {
        for (const t of Object.keys(h.byType)) types.add(t);
      }
      const sorted = Array.from(types).sort();

      const data = history.map((h) => {
        const label = `${new Date(h.cycle_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        const entry: Record<string, string | number> = { name: label };
        for (const t of sorted) {
          entry[t] = h.byType[t] ?? 0;
        }
        entry["total"] = h.total;
        return entry;
      });

      return { chartData: data, allTypes: sorted };
    }

    const grouped = new Map<string, Map<string, number>>();
    for (const exp of timeline) {
      const key = viewMode === "weekly" ? getWeekKey(exp.created_at) : getDayKey(exp.created_at);
      if (!grouped.has(key)) grouped.set(key, new Map());
      const bucket = grouped.get(key)!;
      bucket.set(exp.type, (bucket.get(exp.type) ?? 0) + exp.amount);
    }

    const types = new Set<string>();
    for (const bucket of grouped.values()) {
      for (const t of bucket.keys()) types.add(t);
    }
    const sorted = Array.from(types).sort();

    const data = Array.from(grouped.entries()).map(([name, bucket]) => {
      const entry: Record<string, string | number> = { name };
      let total = 0;
      for (const t of sorted) {
        const v = bucket.get(t) ?? 0;
        entry[t] = v;
        total += v;
      }
      entry["total"] = total;
      return entry;
    });

    return { chartData: data, allTypes: sorted };
  }, [viewMode, history, timeline]);

  if (chartData.length === 0) {
    return <EmptyState message="No expenses to chart yet." />;
  }

  return (
    <>
      <div className="mb-3 flex gap-1">
        {(["daily", "weekly", "monthly"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.005 70)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "oklch(0.5 0.006 60)" }}
            interval={0}
            angle={chartData.length > 6 ? -35 : 0}
            textAnchor={chartData.length > 6 ? "end" : "middle"}
            height={chartData.length > 6 ? 50 : 30}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "oklch(0.5 0.006 60)" }}
            tickFormatter={(v: number) => `${currency} ${v.toLocaleString()}`}
            width={65}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              EXPENSE_TYPE_LABELS[name as string] ?? name,
            ]}
          />
          <Legend
            formatter={(value: string) => EXPENSE_TYPE_LABELS[value] ?? value}
            wrapperStyle={{ fontSize: "11px" }}
          />
          {allTypes.map((t, i) => (
            <Bar
              key={t}
              dataKey={t}
              stackId="expenses"
              fill={CATEGORY_COLORS[t] ?? MEMBER_COLORS[i % MEMBER_COLORS.length]}
              radius={t === allTypes[allTypes.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

// --- Category Donut Chart ---

function CategoryPieChart({
  summary,
  currency,
}: {
  summary: ExpenseSummary;
  currency: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const data = useMemo(() => {
    return Object.entries(summary.totalByType)
      .map(([type, amount]) => ({
        name: EXPENSE_TYPE_LABELS[type] ?? type,
        value: amount,
        color: CATEGORY_COLORS[type] ?? "oklch(0.5 0.02 60)",
      }))
      .sort((a, b) => b.value - a.value);
  }, [summary.totalByType]);

  if (data.length === 0) {
    return <EmptyState message="No expenses to chart yet." />;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color}
                stroke="oklch(0.995 0.003 75)"
                strokeWidth={activeIndex === i ? 3 : 1}
                style={{ filter: activeIndex === i ? "brightness(1.1)" : "none" }}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [
              `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              "Amount",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: d.color, opacity: activeIndex === null || activeIndex === i ? 1 : 0.4 }}
            />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-medium text-foreground">
              {currency} {d.value.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Who Paid Line Chart ---

function PayerBarChart({
  summary,
  members,
  currency,
}: {
  summary: ExpenseSummary;
  members: Member[];
  currency: string;
}) {
  const data = useMemo(() => {
    return Object.entries(summary.totalByPayer)
      .map(([userId, amount]) => ({
        name: members.find((m) => m.user_id === userId)?.full_name ?? "Unknown",
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [summary.totalByPayer, members]);

  if (data.length === 0) {
    return <EmptyState message="No expenses to chart yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.005 70)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "oklch(0.5 0.006 60)" }}
          interval={0}
          angle={data.length > 4 ? -25 : 0}
          textAnchor={data.length > 4 ? "end" : "middle"}
          height={data.length > 4 ? 50 : 30}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "oklch(0.5 0.006 60)" }}
          tickFormatter={(v: number) => `${currency} ${v.toLocaleString()}`}
          width={65}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [
            `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            "Paid",
          ]}
        />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={40}>
          {data.map((_, i) => (
            <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// --- Per Person Horizontal Bar ---

function PerPersonBarChart({
  summary,
  members,
  currency,
}: {
  summary: ExpenseSummary;
  members: Member[];
  currency: string;
}) {
  const data = useMemo(() => {
    return Object.entries(summary.totalByMember)
      .map(([userId, amount]) => ({
        name: members.find((m) => m.user_id === userId)?.full_name ?? "Unknown",
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [summary.totalByMember, members]);

  if (data.length === 0) {
    return <EmptyState message="No expense shares to chart yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 60)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.005 70)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "oklch(0.5 0.006 60)" }}
          tickFormatter={(v: number) => `${currency} ${v.toLocaleString()}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "oklch(0.5 0.006 60)" }}
          width={80}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [
            `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            "Owes",
          ]}
        />
        <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={28}>
          {data.map((_, i) => (
            <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// --- Fixed vs Variable Comparison ---

function FixedVsVariableChart({
  summary,
  currency,
}: {
  summary: ExpenseSummary;
  currency: string;
}) {
  const data = [
    { name: "Fixed", value: summary.fixedBillsTotal, color: "oklch(0.5 0.02 60)" },
    { name: "Variable", value: summary.variableTotal, color: "oklch(0.58 0.13 40)" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <EmptyState message="No bills or expenses to chart yet." />;
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Progress bar */}
      <div className="w-full">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Total</span>
          <span className="font-medium text-foreground">
            {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="h-5 w-full overflow-hidden rounded-full bg-secondary">
          {data.map((d) => (
            <div
              key={d.name}
              className="h-full float-left transition-all"
              style={{
                width: `${(d.value / total) * 100}%`,
                backgroundColor: d.color,
              }}
            />
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className="flex flex-wrap justify-center gap-5 text-sm">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.name}:</span>
            <span className="font-medium text-foreground">
              {currency} {d.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-muted-foreground">
              ({((d.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Empty State ---

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
  );
}

// --- Swipable Tabs ---

function SwipableTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: readonly { id: ChartTab; label: string }[];
  activeTab: ChartTab;
  onTabChange: (id: ChartTab) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -100 : 100, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-1">
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/90 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto py-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/90 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// --- Main Component ---

export function SpendingChart({
  history,
  timeline,
  summary,
  members,
  currency,
}: {
  history: CycleHistory[];
  timeline: ExpenseWithTimestamp[];
  summary: ExpenseSummary;
  members: Member[];
  currency: string;
}) {
  const [activeTab, setActiveTab] = useState<ChartTab>("timeline");

  const hasData = history.length > 0 || timeline.length > 0 || summary.grandTotal > 0;
  if (!hasData) return null;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Insights</CardTitle>
        <SwipableTabs tabs={CHART_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </CardHeader>
      <CardContent className="overflow-hidden px-3 pb-4 sm:px-6">
        {activeTab === "timeline" && (
          <TimelineChart history={history} timeline={timeline} currency={currency} />
        )}
        {activeTab === "category" && (
          <CategoryPieChart summary={summary} currency={currency} />
        )}
        {activeTab === "payer" && (
          <PayerBarChart summary={summary} members={members} currency={currency} />
        )}
        {activeTab === "share" && (
          <PerPersonBarChart summary={summary} members={members} currency={currency} />
        )}
        {activeTab === "fixedVsVar" && (
          <FixedVsVariableChart summary={summary} currency={currency} />
        )}
      </CardContent>
    </Card>
  );
}
