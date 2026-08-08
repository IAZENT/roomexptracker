import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ShoppingCart, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { HouseholdSetup } from "./household-setup";
import { HouseholdOverview } from "./household-overview";
import { getFixedBills, ensureCurrentCycle, getCycles, getExpenses, getActiveMembers, getCycleHistory, getReceiptsForCycle, getArchivedHouseholds, getExpenseTimeline, getExpenseSummary, getPersonalSummary, getCustomExpenseTypes, getExpenseSharesForCycle } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("household_members")
    .select("role, household:households(id, name, cycle_end_day, currency, invite_code, archived_at)")
    .eq("user_id", user.id)
    .is("left_at", null)
    .returns<{ role: string; household: {
      id: string;
      name: string;
      cycle_end_day: number;
      currency: string;
      invite_code: string | null;
      archived_at: string | null;
    } | null }[]>();

  const active = membership?.find((m) => m.household && !m.household.archived_at);

  // Fetch data if household exists
  let bills: Awaited<ReturnType<typeof getFixedBills>> = [];
  let currentCycle: Awaited<ReturnType<typeof ensureCurrentCycle>> = null;
  let cycles: Awaited<ReturnType<typeof getCycles>> = [];
  let expenses: Awaited<ReturnType<typeof getExpenses>> = [];
  let members: Awaited<ReturnType<typeof getActiveMembers>> = [];
  let cycleHistory: Awaited<ReturnType<typeof getCycleHistory>> = [];
  let timeline: Awaited<ReturnType<typeof getExpenseTimeline>> = [];
  let summary: Awaited<ReturnType<typeof getExpenseSummary>> = {
    totalByType: {},
    totalByPayer: {},
    totalByMember: {},
    grandTotal: 0,
    fixedBillsTotal: 0,
    variableTotal: 0,
  };
  let personalSummary: Awaited<ReturnType<typeof getPersonalSummary>> = {
    totalPaid: 0,
    totalOwed: 0,
    expenseCount: 0,
    byType: {},
    byTypeOwed: {},
    recentExpenses: [],
    dailySpending: [],
    topPayerBreakdown: [],
  };
  let customTypes: Awaited<ReturnType<typeof getCustomExpenseTypes>> = [];
  let expenseShares: Awaited<ReturnType<typeof getExpenseSharesForCycle>> = {};
  const closedCycleReceipts: Record<string, Awaited<ReturnType<typeof getReceiptsForCycle>>> = {};

  if (active?.household) {
    const hid = active.household.id;

    // Fetch all data in parallel for faster page load
    [bills, currentCycle, cycles, cycleHistory, timeline, summary, personalSummary, customTypes] = await Promise.all([
      getFixedBills(hid),
      ensureCurrentCycle(hid, active.household.cycle_end_day),
      getCycles(hid),
      getCycleHistory(hid),
      getExpenseTimeline(hid),
      getExpenseSummary(hid, null),
      getPersonalSummary(hid, null, user.id),
      getCustomExpenseTypes(hid),
    ]);

    if (currentCycle) {
      [expenses, summary, personalSummary, expenseShares] = await Promise.all([
        getExpenses(currentCycle.id),
        getExpenseSummary(hid, currentCycle.id),
        getPersonalSummary(hid, currentCycle.id, user.id),
        getExpenseSharesForCycle(currentCycle.id),
      ]);
    }

    members = await getActiveMembers(hid);

    // Fetch receipts for closed cycles
    for (const cycle of cycles.filter((c) => c.status === "closed")) {
      closedCycleReceipts[cycle.id] = await getReceiptsForCycle(cycle.id);
    }
  }

  const archivedHouseholds = await getArchivedHouseholds(user.id);

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <Image src="/logo-mark.png" alt="" width={24} height={24} className="rounded-lg sm:h-7 sm:w-7" />
            <h1 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              RoomMate
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {active?.household && (
              <Link href="/dashboard/shopping">
                <Button variant="ghost" size="sm" className="gap-1.5 px-2 sm:px-3">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="hidden sm:inline">Shopping</span>
                </Button>
              </Link>
            )}
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit" className="px-2 sm:px-3">
                <LogOut className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-8 sm:px-6 sm:py-16">
        {active?.household ? (
          <HouseholdOverview
            household={active.household}
            role={active.role}
            bills={bills}
            currentCycle={currentCycle}
            cycles={cycles}
            expenses={expenses}
            members={members}
            currentUserId={user.id}
            cycleHistory={cycleHistory}
            timeline={timeline}
            summary={summary}
            personalSummary={personalSummary}
            customTypes={customTypes}
            closedCycleReceipts={closedCycleReceipts}
            archivedHouseholds={archivedHouseholds}
            expenseShares={expenseShares}
          />
        ) : (
          <HouseholdSetup />
        )}
      </main>
    </div>
  );
}
