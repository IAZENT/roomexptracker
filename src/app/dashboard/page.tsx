import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { HouseholdSetup } from "./household-setup";
import { HouseholdOverview } from "./household-overview";
import { getFixedBills, ensureCurrentCycle, getCycles, getExpenses, getActiveMembers, getCycleHistory, getReceiptsForCycle, getArchivedHouseholds, getExpenseTimeline, getExpenseSummary, getPersonalSummary, getCustomExpenseTypes } from "./actions";

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
    recentExpenses: [],
  };
  let customTypes: Awaited<ReturnType<typeof getCustomExpenseTypes>> = [];
  const closedCycleReceipts: Record<string, Awaited<ReturnType<typeof getReceiptsForCycle>>> = {};

  if (active?.household) {
    bills = await getFixedBills(active.household.id);
    currentCycle = await ensureCurrentCycle(active.household.id, active.household.cycle_end_day);
    cycles = await getCycles(active.household.id);
    cycleHistory = await getCycleHistory(active.household.id);
    timeline = await getExpenseTimeline(active.household.id);
    summary = await getExpenseSummary(active.household.id, currentCycle?.id ?? null);
    personalSummary = await getPersonalSummary(active.household.id, currentCycle?.id ?? null, user.id);
    customTypes = await getCustomExpenseTypes(active.household.id);

    if (currentCycle) {
      expenses = await getExpenses(currentCycle.id);
    }

    members = await getActiveMembers(active.household.id);

    // Fetch receipts for closed cycles
    for (const cycle of cycles.filter((c) => c.status === "closed")) {
      closedCycleReceipts[cycle.id] = await getReceiptsForCycle(cycle.id);
    }
  }

  const archivedHouseholds = await getArchivedHouseholds(user.id);

  return (
    <div className="min-h-svh bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Image src="/logo-mark.png" alt="" width={28} height={28} className="rounded-lg" />
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            RoomMate
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {active?.household && (
            <Link href="/dashboard/shopping">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ShoppingCart className="h-4 w-4" />
                Shopping
              </Button>
            </Link>
          )}
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Log out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16">
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
          />
        ) : (
          <HouseholdSetup />
        )}
      </main>
    </div>
  );
}
