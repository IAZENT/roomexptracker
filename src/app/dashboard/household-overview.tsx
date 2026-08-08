"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FixedBillsSettings } from "./fixed-bills-settings";
import { AddExpenseDialog } from "./add-expense-dialog";
import { SpendingChart } from "./spending-chart";
import { ReceiptDialog } from "./receipt-view";
import { ArchiveHouseholdButton } from "./archive-household";
import { PersonalDashboard } from "./personal-dashboard";
import { CustomTypesSettings } from "./custom-types-settings";
import type { FixedBill, BillingCycle, Expense, Member, CycleHistory, Receipt, ExpenseWithTimestamp, ExpenseSummary, PersonalSummary, CustomExpenseType } from "./actions";

type Household = {
  id: string;
  name: string;
  cycle_end_day: number;
  currency: string;
  invite_code: string | null;
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  electricity: "Electricity",
  groceries: "Groceries",
  drinking_water: "Drinking water",
  other: "Other",
};

type DashboardView = "personal" | "shared";

export function HouseholdOverview({
  household,
  role,
  bills,
  currentCycle,
  cycles,
  expenses,
  members,
  currentUserId,
  cycleHistory,
  timeline,
  summary,
  personalSummary,
  customTypes,
  closedCycleReceipts,
  archivedHouseholds,
}: {
  household: Household;
  role: string;
  bills: FixedBill[];
  currentCycle: BillingCycle | null;
  cycles: BillingCycle[];
  expenses: Expense[];
  members: Member[];
  currentUserId: string;
  cycleHistory: CycleHistory[];
  timeline: ExpenseWithTimestamp[];
  summary: ExpenseSummary;
  personalSummary: PersonalSummary;
  customTypes: CustomExpenseType[];
  closedCycleReceipts: Record<string, Receipt[]>;
  archivedHouseholds: { id: string; name: string; archived_at: string | null; created_at: string }[];
}) {
  const [view, setView] = useState<DashboardView>("shared");
  const closedCycles = cycles.filter((c) => c.status === "closed");
  const cycleTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const EXPENSES_PAGE_SIZE = 10;
  const visibleExpenses = showAllExpenses ? expenses : expenses.slice(0, EXPENSES_PAGE_SIZE);
  const hasMoreExpenses = expenses.length > EXPENSES_PAGE_SIZE;

  // Merge labels for expense list display
  const allTypeLabels = { ...EXPENSE_TYPE_LABELS };
  for (const t of customTypes) {
    allTypeLabels[t.name.toLowerCase()] = t.name;
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {household.name}
          </h2>
          <Badge variant="secondary" className="capitalize">
            {role}
          </Badge>
        </div>
      </div>

      {/* View toggle */}
      <div className="mb-6 flex rounded-lg border border-border bg-secondary/50 p-1">
        <button
          onClick={() => setView("personal")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "personal"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Personal
        </button>
        <button
          onClick={() => setView("shared")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "shared"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Shared
        </button>
      </div>

      {/* ========== PERSONAL VIEW ========== */}
      {view === "personal" && (
        <>
          <PersonalDashboard
            summary={personalSummary}
            members={members}
            currency={household.currency}
            currentUserId={currentUserId}
          />

          {/* Add expense (still available in personal view) */}
          {currentCycle && (
            <div className="mt-4">
              <AddExpenseDialog
                cycleId={currentCycle.id}
                members={members}
                currentUserId={currentUserId}
                currency={household.currency}
                customTypes={customTypes}
                hidePayer
              />
            </div>
          )}

          {/* Custom types settings for owner in personal view */}
          {role === "owner" && (
            <div className="mt-4">
              <CustomTypesSettings types={customTypes} householdId={household.id} />
            </div>
          )}
        </>
      )}

      {/* ========== SHARED VIEW ========== */}
      {view === "shared" && (
        <>
          {/* Household details */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Household details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Billing cycle ends</span>
                <span className="font-medium text-foreground">
                  Day {household.cycle_end_day} of each month
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium text-foreground">{household.currency}</span>
              </div>

              {role === "owner" ? (
                <div className="mt-2 rounded-xl bg-secondary px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Invite code - share with roommates so they can join
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tracking-[0.3em] text-primary">
                    {household.invite_code}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Ask the household owner for the invite code to add more roommates.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Current cycle */}
          {currentCycle && (
            <Card className="mt-4 border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Current cycle</CardTitle>
                <AddExpenseDialog
                  cycleId={currentCycle.id}
                  members={members}
                  currentUserId={currentUserId}
                  currency={household.currency}
                  customTypes={customTypes}
                />
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Period</span>
                    <span className="font-medium text-foreground">
                      {new Date(currentCycle.cycle_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                      -{" "}
                      {new Date(currentCycle.cycle_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expenses</span>
                    <span className="font-medium text-foreground">
                      {household.currency} {cycleTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {members.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Per person</span>
                      <span className="font-medium text-foreground">
                        {household.currency} {(cycleTotal / members.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expenses list */}
          {expenses.length > 0 && (
            <Card className="mt-4 border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Expenses this cycle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {visibleExpenses.map((expense) => {
                    const payer = members.find((m) => m.user_id === expense.paid_by);
                    return (
                      <div key={expense.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {allTypeLabels[expense.type] ?? expense.type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Paid by {payer?.full_name ?? "Unknown"}
                            {expense.description && ` - ${expense.description}`}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {household.currency} {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {hasMoreExpenses && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full text-muted-foreground"
                    onClick={() => setShowAllExpenses(!showAllExpenses)}
                  >
                    {showAllExpenses
                      ? "Show less"
                      : `Show all ${expenses.length} expenses`}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fixed bills - owner only */}
          {role === "owner" && (
            <div className="mt-4">
              <FixedBillsSettings bills={bills} currency={household.currency} />
            </div>
          )}

          {/* Show fixed bills summary for non-owners */}
          {role !== "owner" && bills.length > 0 && (
            <Card className="mt-4 border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Fixed bills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 text-sm">
                  {bills.map((bill) => (
                    <div key={bill.type} className="flex items-center justify-between">
                      <span className="capitalize text-muted-foreground">{bill.type}</span>
                      <span className="font-medium text-foreground">
                        {household.currency} {bill.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Custom types settings */}
          {role === "owner" && (
            <div className="mt-4">
              <CustomTypesSettings types={customTypes} householdId={household.id} />
            </div>
          )}

          {/* Past cycles */}
          {closedCycles.length > 0 && (
            <Card className="mt-4 border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Past cycles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {closedCycles.slice(0, 5).map((cycle) => {
                    const userReceipt = closedCycleReceipts[cycle.id]?.find(
                      (r) => r.user_id === currentUserId,
                    );
                    const ct = cycleHistory.find((h) => h.id === cycle.id)?.total ?? 0;

                    return (
                      <div key={cycle.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {new Date(cycle.cycle_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                            -{" "}
                            {new Date(cycle.cycle_end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Total: {household.currency} {ct.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            {userReceipt && ` | You owe: ${household.currency} ${userReceipt.total_owed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>
                        {userReceipt && (
                          <ReceiptDialog
                            receipt={userReceipt}
                            householdName={household.name}
                            currency={household.currency}
                            cycleStart={cycle.cycle_start}
                            cycleEnd={cycle.cycle_end}
                            userName={members.find((m) => m.user_id === currentUserId)?.full_name ?? "You"}
                            trigger={
                              <Badge variant="outline" className="cursor-pointer">
                                View receipt
                              </Badge>
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Insights chart */}
          <div className="mt-4">
            <SpendingChart
              history={cycleHistory}
              timeline={timeline}
              summary={summary}
              members={members}
              currency={household.currency}
            />
          </div>
        </>
      )}

      {/* Archived households */}
      {archivedHouseholds.length > 0 && (
        <Card className="mt-4 border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Archived households</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {archivedHouseholds.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{h.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Created {new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <Badge variant="secondary">Archived</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Archive button (owner only) */}
      {role === "owner" && (
        <div className="mt-4 flex justify-center">
          <ArchiveHouseholdButton />
        </div>
      )}
    </div>
  );
}
