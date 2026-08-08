"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FixedBillsSettings } from "./fixed-bills-settings";
import { AddExpenseDialog } from "./add-expense-dialog";
import { EditExpenseDialog } from "./edit-expense-dialog";
import { SpendingChart } from "./spending-chart";
import { ReceiptDialog } from "./receipt-view";
import { ArchiveHouseholdButton } from "./archive-household";
import { PersonalDashboard } from "./personal-dashboard";
import { CustomTypesSettings } from "./custom-types-settings";
import { PaysForSettings } from "./pays-for-settings";
import { requestCycleClose, approveCycleClose } from "./actions";
import { EXPENSE_TYPE_LABELS } from "@/lib/constants";
import { Pencil, ChevronDown } from "lucide-react";
import { SettlementDialog } from "./settlement-dialog";
import { BalanceHistoryChart } from "./balance-history";
import type { FixedBill, BillingCycle, Expense, Member, CycleHistory, Receipt, ExpenseWithTimestamp, ExpenseSummary, PersonalSummary, CustomExpenseType, ExpenseShare, CloseRequest, CloseApproval } from "./actions";

type Household = {
  id: string;
  name: string;
  cycle_end_day: number;
  currency: string;
  invite_code: string | null;
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
  expenseShares,
  closeRequest,
  balanceHistory,
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
  expenseShares: Record<string, ExpenseShare[]>;
  closeRequest: { request: CloseRequest | null; approvals: CloseApproval[] };
  balanceHistory: { cycleLabel: string; cycleId: string; members: Record<string, { name: string; balance: number }> }[];
}) {
  const [view, setView] = useState<DashboardView>("shared");
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showSettlements, setShowSettlements] = useState(false);
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set());
  const EXPENSES_PAGE_SIZE = 10;
  const visibleExpenses = showAllExpenses ? expenses : expenses.slice(0, EXPENSES_PAGE_SIZE);
  const hasMoreExpenses = expenses.length > EXPENSES_PAGE_SIZE;
  const cycleTotal = summary.grandTotal;
  const closedCycles = cycles.filter((c) => c.status === "closed");

  // Merge labels for expense list display
  const allTypeLabels = { ...EXPENSE_TYPE_LABELS };
  for (const t of customTypes) {
    allTypeLabels[t.name.toLowerCase()] = t.name;
  }

  return (
    <div className="w-full max-w-2xl">
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
                currentUserId={currentUserId}
                currency={household.currency}
                customTypes={customTypes}
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
                      <span className="text-muted-foreground">Your share</span>
                      <span className="font-medium text-foreground">
                        {household.currency} {(summary.totalByMember[currentUserId] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settlements button */}
          {currentCycle && expenses.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 mt-3"
              onClick={() => setShowSettlements(true)}
            >
              View settlements
            </Button>
          )}

          {/* Close cycle voting */}
          {currentCycle && expenses.length > 0 && (
            <div className="mt-3">
              {!closeRequest.request ? (
                /* No pending request: show "Request close" button */
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  disabled={closing}
                  onClick={async () => {
                    setClosing(true);
                    const result = await requestCycleClose(currentCycle.id);
                    setClosing(false);
                    if (result.error) {
                      const { toast } = await import("sonner");
                      toast.error(result.error);
                    } else {
                      window.location.reload();
                    }
                  }}
                >
                  {closing ? "Requesting..." : "Request cycle close"}
                </Button>
              ) : (
                /* Pending request: show voting status */
                <Card className="border-border shadow-sm">
                  <CardContent className="pt-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Close cycle request</span>
                        <Badge variant={closeRequest.request.status === "approved" ? "default" : "secondary"}>
                          {closeRequest.request.status === "approved" ? "Approved" : "Pending votes"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Requested by {members.find((m) => m.user_id === closeRequest.request!.requested_by)?.full_name ?? "Unknown"}
                      </p>

                      {/* Approval progress */}
                      <div className="flex flex-col gap-1.5">
                        {members.map((m) => {
                          const approval = closeRequest.approvals.find((a) => a.user_id === m.user_id);
                          return (
                            <div key={m.user_id} className="flex items-center gap-2 text-xs">
                              {approval?.approved ? (
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                              ) : approval ? (
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-muted" />
                              )}
                              <span className="text-muted-foreground">
                                {m.full_name}
                                {m.user_id === currentUserId && " (you)"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Approve/reject buttons (only for users who haven't voted) */}
                      {closeRequest.request.status === "pending" &&
                        !closeRequest.approvals.find((a) => a.user_id === currentUserId) && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={async () => {
                                const result = await approveCycleClose(closeRequest.request!.id, true);
                                if (result.error) {
                                  const { toast } = await import("sonner");
                                  toast.error(result.error);
                                } else {
                                  window.location.reload();
                                }
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={async () => {
                                const result = await approveCycleClose(closeRequest.request!.id, false);
                                if (result.error) {
                                  const { toast } = await import("sonner");
                                  toast.error(result.error);
                                } else {
                                  window.location.reload();
                                }
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        )}

                      {closeRequest.request.status === "approved" && (
                        <p className="text-xs text-green-600 pt-1">All members approved. Cycle closed.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
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
                    const shares = expenseShares[expense.id] ?? [];
                    const currentUserShare = shares.find((s) => s.user_id === currentUserId);
                    // Not a uniform "per person" split - pays_for coverage can make shares
                    // unequal, so this is specifically what the viewer owes for this expense.
                    // No fabricated fallback: if there's no real share row (e.g. the viewer
                    // joined the household after this expense was created), they genuinely
                    // owe nothing for it - showing a naive amount/N guess here was misleading.
                    const yourShare = currentUserShare?.share_amount ?? 0;
                    const isExpanded = expandedExpenses.has(expense.id);
                    const hasItems = expense.metadata && expense.metadata.length > 0;
                    return (
                      <div key={expense.id} className="rounded-lg bg-secondary/50">
                        <div
                          className={`flex items-center justify-between px-3 py-2 ${hasItems ? "cursor-pointer hover:bg-secondary/70 transition-colors" : ""}`}
                          onClick={() => {
                            if (hasItems) {
                              setExpandedExpenses((prev) => {
                                const next = new Set(prev);
                                if (next.has(expense.id)) {
                                  next.delete(expense.id);
                                } else {
                                  next.add(expense.id);
                                }
                                return next;
                              });
                            }
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {allTypeLabels[expense.type] ?? expense.type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Paid by {payer?.full_name ?? "Unknown"}
                              {expense.description && ` - ${expense.description}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-medium text-foreground">
                                {household.currency} {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {household.currency} {yourShare.toLocaleString(undefined, { minimumFractionDigits: 2 })} your share
                              </span>
                            </div>
                          {expense.paid_by === currentUserId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingExpense(expense);
                              }}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                            {hasItems && (
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            )}
                          </div>
                        </div>
                        {hasItems && isExpanded && (
                          <div className="border-t border-border/50 px-3 py-2">
                            <div className="flex flex-col gap-1">
                              {expense.metadata!.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{item.name}</span>
                                  <span className="font-medium text-foreground">
                                    {household.currency} {item.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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

          {/* Pays-for settings - owner only */}
          {role === "owner" && (
            <div className="mt-4">
              <PaysForSettings householdId={household.id} members={members} role={role} />
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
                <CardTitle className="text-base">Past cycles & receipts</CardTitle>
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
                        {userReceipt ? (
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
                        ) : (
                          <Badge variant="secondary">No receipt</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receipt info when no closed cycles */}
          {closedCycles.length === 0 && (
            <Card className="mt-4 border-border shadow-sm">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground text-center">
                  Receipts will be generated when billing cycles close. Each person&apos;s itemized breakdown will be available here.
                </p>
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

          {/* Balance history */}
          {balanceHistory.length > 0 && (
            <Card className="mt-4 border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Balance history</CardTitle>
              </CardHeader>
              <CardContent>
                <BalanceHistoryChart data={balanceHistory} currency={household.currency} />
              </CardContent>
            </Card>
          )}
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

      {/* Edit expense dialog */}
      {editingExpense && (
        <EditExpenseDialog
          expenseId={editingExpense.id}
          initialType={editingExpense.type}
          initialAmount={editingExpense.amount}
          initialPaidBy={editingExpense.paid_by}
          initialDescription={editingExpense.description ?? ""}
          initialMetadata={editingExpense.metadata ?? null}
          currency={household.currency}
          customTypes={customTypes}
          open={!!editingExpense}
          onOpenChange={(o) => { if (!o) setEditingExpense(null); }}
        />
      )}

      {/* Settlement dialog */}
      {currentCycle && (
        <SettlementDialog
          cycleId={currentCycle.id}
          currency={household.currency}
          open={showSettlements}
          onOpenChange={setShowSettlements}
        />
      )}
    </div>
  );
}
