"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HouseholdActionState = {
  error: string | null;
  values?: { name?: string; cycleEndDay?: string; currency?: string; code?: string };
};

export type FixedBill = {
  id: string;
  type: "rent" | "water" | "garbage" | "other";
  amount: number;
  effective_from: string;
};

export type BillingCycle = {
  id: string;
  household_id: string;
  cycle_start: string;
  cycle_end: string;
  status: "open" | "closed";
  member_count_snapshot: number | null;
};

// ---------------------------------------------------------------------------
// Household create / join (existing)
// ---------------------------------------------------------------------------

export async function createHousehold(
  _prevState: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const name = formData.get("name") as string;
  const cycleEndDayRaw = formData.get("cycleEndDay") as string;
  const cycleEndDay = Number(cycleEndDayRaw);
  const currency = (formData.get("currency") as string) || "NPR";
  const values = { name, cycleEndDay: cycleEndDayRaw, currency };

  if (!Number.isInteger(cycleEndDay) || cycleEndDay < 1 || cycleEndDay > 31) {
    return { error: "Cycle end day must be between 1 and 31.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", {
    p_name: name,
    p_cycle_end_day: cycleEndDay,
    p_currency: currency,
  });

  if (error) return { error: error.message, values };

  revalidatePath("/dashboard");
  return { error: null };
}

export async function joinHousehold(
  _prevState: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const code = (formData.get("code") as string)?.trim();
  const values = { code };

  if (!code) return { error: "Enter an invite code.", values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_household_by_code", {
    p_code: code,
  });

  if (error) return { error: "Invalid or expired invite code.", values };

  revalidatePath("/dashboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Fixed bills
// ---------------------------------------------------------------------------

export type FixedBillActionState = {
  error: string | null;
  values?: Record<string, string>;
};

export async function upsertFixedBills(
  prevState: FixedBillActionState,
  formData: FormData,
): Promise<FixedBillActionState> {
  const raw = formData.get("bills") as string;
  let bills: Record<string, number>;
  try {
    bills = JSON.parse(raw);
  } catch {
    return { error: "Invalid bill data." };
  }

  if (!bills || typeof bills !== "object") {
    return { error: "No bills provided." };
  }

  const values: Record<string, string> = {};
  for (const [type, amount] of Object.entries(bills)) {
    values[type] = amount.toString();
  }

  for (const amount of Object.values(bills)) {
    if (amount < 0) {
      return { error: "Amounts cannot be negative.", values };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", values };

  // Get active household
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .is("left_at", null)
    .single();

  if (!membership || membership.role !== "owner") {
    return { error: "Only the household owner can edit fixed bills.", values };
  }

  const householdId = membership.household_id;
  const today = new Date().toISOString().split("T")[0];

  for (const [type, amount] of Object.entries(bills)) {
    const trimmedType = type.trim().toLowerCase();
    if (!trimmedType) continue;

    const { data: existing } = await supabase
      .from("fixed_bills")
      .select("id, amount")
      .eq("household_id", householdId)
      .eq("type", trimmedType)
      .order("effective_from", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      if (existing.amount !== amount) {
        await supabase.from("fixed_bills").insert({
          household_id: householdId,
          type: trimmedType,
          amount,
          effective_from: today,
        });
      }
    } else if (amount > 0) {
      await supabase.from("fixed_bills").insert({
        household_id: householdId,
        type: trimmedType,
        amount,
        effective_from: today,
      });
    }
  }

  revalidatePath("/dashboard");
  return { error: null };
}

export async function getFixedBills(householdId: string): Promise<FixedBill[]> {
  const supabase = await createClient();

  // Get the latest effective bill for each type
  const { data } = await supabase
    .from("fixed_bills")
    .select("*")
    .eq("household_id", householdId)
    .order("effective_from", { ascending: false });

  if (!data) return [];

  // Deduplicate - keep only the latest per type
  const seen = new Map<string, FixedBill>();
  for (const bill of data) {
    if (!seen.has(bill.type)) {
      seen.set(bill.type, bill);
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Billing cycles
// ---------------------------------------------------------------------------

function computeCycleDates(cycleEndDay: number): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Current cycle end: this month's cycle_end_day
  let cycleEnd = new Date(year, month, cycleEndDay);

  // If today is past this month's cycle_end, the current cycle ends next month
  if (now > cycleEnd) {
    cycleEnd = new Date(year, month + 1, cycleEndDay);
  }

  // Cycle start is the day after the previous cycle ended
  const cycleStart = new Date(cycleEnd);
  cycleStart.setDate(cycleStart.getDate() - 31); // Approximate - we'll adjust

  // Actually: cycle starts on (previous cycle_end + 1 day)
  // Previous cycle ended at cycleEndDay of the previous month
  let prevCycleEnd = new Date(year, month, cycleEndDay);
  if (now > prevCycleEnd) {
    prevCycleEnd = new Date(year, month + 1, cycleEndDay);
  }
  // Previous cycle ended 1 month before current cycle end
  prevCycleEnd.setMonth(prevCycleEnd.getMonth() - 1);

  const start = new Date(prevCycleEnd);
  start.setDate(start.getDate() + 1);

  return {
    start: start.toISOString().split("T")[0],
    end: cycleEnd.toISOString().split("T")[0],
  };
}

export async function ensureCurrentCycle(
  householdId: string,
  cycleEndDay: number,
): Promise<BillingCycle | null> {
  const supabase = await createClient();
  const { start, end } = computeCycleDates(cycleEndDay);
  const today = new Date().toISOString().split("T")[0];

  // Check if an open cycle exists that covers today
  const { data: openCycle } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "open")
    .single();

  if (openCycle) {
    // If the open cycle's end date has passed, close it
    if (openCycle.cycle_end < today) {
      // Get current active member count
      const { count } = await supabase
        .from("household_members")
        .select("*", { count: "exact", head: true })
        .eq("household_id", householdId)
        .is("left_at", null);

      await supabase
        .from("billing_cycles")
        .update({
          status: "closed",
          member_count_snapshot: count || 0,
          closed_at: new Date().toISOString(),
        })
        .eq("id", openCycle.id);

      // Generate receipts for the closed cycle
      await generateReceipts(householdId, openCycle.id, count || 0);

      // Fall through to create next cycle
    } else {
      return openCycle;
    }
  }

  // Create new open cycle
  const { data: newCycle, error } = await supabase
    .from("billing_cycles")
    .insert({
      household_id: householdId,
      cycle_start: start,
      cycle_end: end,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create cycle:", error);
    return null;
  }

  return newCycle;
}

// ---------------------------------------------------------------------------
// Receipt generation
// ---------------------------------------------------------------------------

async function generateReceipts(
  householdId: string,
  cycleId: string,
  memberCount: number,
) {
  const supabase = await createClient();

  // Get all active members
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .is("left_at", null);

  if (!members || members.length === 0) return;

  // Get the cycle's start date to filter fixed bills
  const { data: cycle } = await supabase
    .from("billing_cycles")
    .select("cycle_start")
    .eq("id", cycleId)
    .single();

  // Get fixed bills effective for this cycle (effective_from <= cycle start)
  const { data: fixedBills } = await supabase
    .from("fixed_bills")
    .select("type, amount")
    .eq("household_id", householdId)
    .lte("effective_from", cycle?.cycle_start ?? new Date().toISOString().split("T")[0])
    .order("effective_from", { ascending: false });

  // Deduplicate fixed bills (latest per type)
  const latestBills = new Map<string, number>();
  if (fixedBills) {
    for (const bill of fixedBills) {
      if (!latestBills.has(bill.type)) {
        latestBills.set(bill.type, bill.amount);
      }
    }
  }

  // Get expenses and their shares for this cycle
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, type, amount, paid_by")
    .eq("cycle_id", cycleId);

  // Get all shares
  const expenseIds = (expenses ?? []).map((e) => e.id);
  let allShares: { expense_id: string; user_id: string; share_amount: number }[] = [];

  if (expenseIds.length > 0) {
    const { data: shares } = await supabase
      .from("expense_shares")
      .select("expense_id, user_id, share_amount")
      .in("expense_id", expenseIds);

    allShares = shares ?? [];
  }

  // Generate a receipt for each member
  for (const member of members) {
    const fixedBillsObj: Record<string, number> = {};
    for (const [type, amount] of latestBills) {
      fixedBillsObj[type] = Math.round((amount / memberCount) * 100) / 100;
    }

    const expenseSharesArr: { expense_id: string; type: string; amount: number; share: number }[] = [];
    let totalFixed = 0;
    for (const amount of latestBills.values()) {
      totalFixed += amount / memberCount;
    }

    let totalExpenses = 0;
    const memberShares = allShares.filter((s) => s.user_id === member.user_id);
    for (const share of memberShares) {
      const expense = (expenses ?? []).find((e) => e.id === share.expense_id);
      if (expense) {
        totalExpenses += share.share_amount;
        expenseSharesArr.push({
          expense_id: share.expense_id,
          type: expense.type,
          amount: expense.amount,
          share: share.share_amount,
        });
      }
    }

    const totalOwed = totalFixed + totalExpenses;

    await supabase.from("receipts").insert({
      cycle_id: cycleId,
      user_id: member.user_id,
      itemized_breakdown: {
        fixed_bills: fixedBillsObj,
        expense_shares: expenseSharesArr,
      },
      total_owed: Math.round(totalOwed * 100) / 100,
    });
  }
}

export async function closeCycle(
  cycleId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Get the cycle and verify ownership
  const { data: cycle } = await supabase
    .from("billing_cycles")
    .select("id, household_id, status")
    .eq("id", cycleId)
    .single();

  if (!cycle) return { error: "Cycle not found." };
  if (cycle.status !== "open") return { error: "Cycle is already closed." };

  // Verify user is owner
  const { data: membership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", cycle.household_id)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "owner") {
    return { error: "Only the household owner can close a cycle." };
  }

  // Get active member count
  const { count } = await supabase
    .from("household_members")
    .select("*", { count: "exact", head: true })
    .eq("household_id", cycle.household_id)
    .is("left_at", null);

  // Close the cycle
  const { error: closeError } = await supabase
    .from("billing_cycles")
    .update({
      status: "closed",
      member_count_snapshot: count || 0,
      closed_at: new Date().toISOString(),
    })
    .eq("id", cycleId);

  if (closeError) return { error: closeError.message };

  // Generate receipts
  await generateReceipts(cycle.household_id, cycleId, count || 0);

  revalidatePath("/dashboard");
  return { error: null };
}

export async function getCycles(householdId: string): Promise<BillingCycle[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("household_id", householdId)
    .order("cycle_start", { ascending: false });

  return data || [];
}

export async function getActiveCycle(householdId: string): Promise<BillingCycle | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "open")
    .single();

  return data;
}

// ---------------------------------------------------------------------------
// Members (for split calculation)
// ---------------------------------------------------------------------------

export type Member = {
  user_id: string;
  full_name: string | null;
};

export async function getActiveMembers(householdId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .is("left_at", null);

  if (!data || data.length === 0) return [];

  const userIds = data.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.full_name]),
  );

  return data.map((m) => ({
    user_id: m.user_id,
    full_name: profileMap.get(m.user_id) ?? "Unknown",
  }));
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export type Expense = {
  id: string;
  cycle_id: string;
  household_id: string;
  type: "electricity" | "groceries" | "drinking_water" | "other";
  amount: number;
  paid_by: string;
  description: string | null;
  created_at: string;
};

export type ExpenseShare = {
  expense_id: string;
  user_id: string;
  share_amount: number;
};

export type ExpenseActionState = {
  error: string | null;
  values?: { type?: string; amount?: string; description?: string; paidBy?: string; customShares?: string };
};

export async function addExpense(
  _prevState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const type = formData.get("type") as string;
  const amountRaw = formData.get("amount") as string;
  const description = (formData.get("description") as string) || null;
  const paidBy = formData.get("paidBy") as string;
  const customSharesRaw = formData.get("customShares") as string;
  const cycleId = formData.get("cycleId") as string;
  const values = { type, amount: amountRaw, description: description ?? undefined, paidBy, customShares: customSharesRaw };

  const amount = parseFloat(amountRaw);
  if (!type || isNaN(amount) || amount <= 0) {
    return { error: "Type and a positive amount are required.", values };
  }
  if (!paidBy) {
    return { error: "Select who paid.", values };
  }
  if (!cycleId) {
    return { error: "No active billing cycle.", values };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", values };

  // Get household_id from the cycle
  const { data: cycle } = await supabase
    .from("billing_cycles")
    .select("household_id")
    .eq("id", cycleId)
    .single();

  if (!cycle) return { error: "Invalid billing cycle.", values };

  // Insert the expense
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      cycle_id: cycleId,
      household_id: cycle.household_id,
      type,
      amount,
      paid_by: paidBy,
      description,
    })
    .select()
    .single();

  if (expenseError) return { error: expenseError.message, values };

  // Parse custom shares or default to equal split
  let shares: { user_id: string; share_amount: number }[] = [];

  if (customSharesRaw) {
    try {
      const parsed = JSON.parse(customSharesRaw) as Record<string, number>;
      shares = Object.entries(parsed)
        .filter(([, amt]) => amt > 0)
        .map(([userId, amt]) => ({ user_id: userId, share_amount: amt }));
    } catch {
      // Fall back to equal split
    }
  }

  if (shares.length === 0) {
    // Equal split across active members
    const { data: members } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", cycle.household_id)
      .is("left_at", null);

    if (members && members.length > 0) {
      const shareAmount = Math.round((amount / members.length) * 100) / 100;
      shares = members.map((m) => ({ user_id: m.user_id, share_amount: shareAmount }));
    }
  }

  // Insert shares
  if (shares.length > 0) {
    await supabase.from("expense_shares").insert(
      shares.map((s) => ({
        expense_id: expense.id,
        user_id: s.user_id,
        share_amount: s.share_amount,
      })),
    );
  }

  revalidatePath("/dashboard");
  return { error: null };
}

export async function getExpenses(cycleId: string): Promise<Expense[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: false });

  return data || [];
}

export async function getExpenseShares(expenseId: string): Promise<ExpenseShare[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_shares")
    .select("*")
    .eq("expense_id", expenseId);

  return data || [];
}

export async function getExpenseSharesForCycle(cycleId: string): Promise<Record<string, ExpenseShare[]>> {
  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id")
    .eq("cycle_id", cycleId);

  if (!expenses || expenses.length === 0) return {};

  const expenseIds = expenses.map((e) => e.id);
  const { data: shares } = await supabase
    .from("expense_shares")
    .select("*")
    .in("expense_id", expenseIds);

  if (!shares) return {};

  const sharesByExpense: Record<string, ExpenseShare[]> = {};
  for (const share of shares) {
    if (!sharesByExpense[share.expense_id]) {
      sharesByExpense[share.expense_id] = [];
    }
    sharesByExpense[share.expense_id].push(share);
  }
  return sharesByExpense;
}

export async function deleteExpense(expenseId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Expense timeline (for daily/weekly chart views)
// ---------------------------------------------------------------------------

export type ExpenseWithTimestamp = {
  id: string;
  type: string;
  amount: number;
  created_at: string;
};

export async function getExpenseTimeline(householdId: string): Promise<ExpenseWithTimestamp[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("expenses")
    .select("id, type, amount, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  return (data as ExpenseWithTimestamp[]) || [];
}

// ---------------------------------------------------------------------------
// Expense summary (for charts)
// ---------------------------------------------------------------------------

export type ExpenseSummary = {
  totalByType: Record<string, number>;
  totalByPayer: Record<string, number>;
  totalByMember: Record<string, number>; // share owed
  grandTotal: number;
  fixedBillsTotal: number;
  variableTotal: number;
};

export async function getExpenseSummary(
  householdId: string,
  cycleId: string | null,
): Promise<ExpenseSummary> {
  const supabase = await createClient();

  const summary: ExpenseSummary = {
    totalByType: {},
    totalByPayer: {},
    totalByMember: {},
    grandTotal: 0,
    fixedBillsTotal: 0,
    variableTotal: 0,
  };

  // Get fixed bills
  const { data: bills } = await supabase
    .from("fixed_bills")
    .select("type, amount")
    .eq("household_id", householdId)
    .order("effective_from", { ascending: false });

  const seenBills = new Map<string, number>();
  if (bills) {
    for (const b of bills) {
      if (!seenBills.has(b.type)) seenBills.set(b.type, b.amount);
    }
  }
  for (const amount of seenBills.values()) {
    summary.fixedBillsTotal += amount;
  }

  // Get expenses for the cycle (or all if no cycle)
  let query = supabase
    .from("expenses")
    .select("id, type, amount, paid_by")
    .eq("household_id", householdId);

  if (cycleId) {
    query = query.eq("cycle_id", cycleId);
  }

  const { data: expenses } = await query;

  if (expenses) {
    for (const e of expenses) {
      summary.totalByType[e.type] = (summary.totalByType[e.type] ?? 0) + e.amount;
      summary.totalByPayer[e.paid_by] = (summary.totalByPayer[e.paid_by] ?? 0) + e.amount;
      summary.grandTotal += e.amount;
      summary.variableTotal += e.amount;
    }

    // Get shares for per-member breakdown
    const expenseIds = expenses.map((e) => e.id);
    if (expenseIds.length > 0) {
      const { data: shares } = await supabase
        .from("expense_shares")
        .select("user_id, share_amount")
        .in("expense_id", expenseIds);

      if (shares) {
        for (const s of shares) {
          summary.totalByMember[s.user_id] =
            (summary.totalByMember[s.user_id] ?? 0) + s.share_amount;
        }
      }
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Cycle history (for graphs)
// ---------------------------------------------------------------------------

export type CycleHistory = {
  id: string;
  cycle_start: string;
  cycle_end: string;
  status: "open" | "closed";
  total: number;
  byType: Record<string, number>;
  memberCount: number;
};

export async function getCycleHistory(householdId: string): Promise<CycleHistory[]> {
  const supabase = await createClient();

  const { data: cycles } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("household_id", householdId)
    .order("cycle_start", { ascending: true });

  if (!cycles) return [];

  const history: CycleHistory[] = [];

  for (const cycle of cycles) {
    const { data: expenses } = await supabase
      .from("expenses")
      .select("type, amount")
      .eq("cycle_id", cycle.id);

    const total = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);
    const byType: Record<string, number> = {};
    for (const e of expenses ?? []) {
      byType[e.type] = (byType[e.type] ?? 0) + e.amount;
    }

    history.push({
      id: cycle.id,
      cycle_start: cycle.cycle_start,
      cycle_end: cycle.cycle_end,
      status: cycle.status,
      total,
      byType,
      memberCount: cycle.member_count_snapshot ?? 0,
    });
  }

  return history;
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export type Receipt = {
  id: string;
  cycle_id: string;
  user_id: string;
  itemized_breakdown: {
    fixed_bills: Record<string, number>;
    expense_shares: { expense_id: string; type: string; amount: number; share: number }[];
  };
  total_owed: number;
  generated_at: string;
};

export async function getReceiptsForCycle(cycleId: string): Promise<Receipt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receipts")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("generated_at", { ascending: false });

  return (data as Receipt[]) || [];
}

export async function getReceiptForUser(cycleId: string, userId: string): Promise<Receipt | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receipts")
    .select("*")
    .eq("cycle_id", cycleId)
    .eq("user_id", userId)
    .single();

  return (data as Receipt) || null;
}

// ---------------------------------------------------------------------------
// Archive household
// ---------------------------------------------------------------------------

export type ArchiveActionState = {
  error: string | null;
};

export async function archiveHousehold(
  prevState: ArchiveActionState,
  formData: FormData,
): Promise<ArchiveActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Get active household
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .is("left_at", null)
    .single();

  if (!membership) return { error: "No active household." };
  if (membership.role !== "owner") return { error: "Only the owner can archive." };

  const { error } = await supabase
    .from("households")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", membership.household_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

export async function getArchivedHouseholds(userId: string) {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("household_members")
    .select("household:households(id, name, archived_at, created_at)")
    .eq("user_id", userId)
    .returns<{ household: { id: string; name: string; archived_at: string | null; created_at: string } | null }[]>();

  return (memberships ?? [])
    .filter((m) => m.household?.archived_at)
    .map((m) => m.household!);
}

// ---------------------------------------------------------------------------
// Shopping items (offline-first)
// ---------------------------------------------------------------------------

export type ShoppingItemRow = {
  id: string;
  household_id: string;
  user_id: string;
  cycle_id: string | null;
  name: string;
  cost: number;
  synced: boolean;
  local_id: string | null;
  created_at: string;
  synced_at: string | null;
};

export async function syncShoppingItems(
  items: { localId: string; name: string; cost: number; householdId: string; cycleId: string | null; createdAt: string }[],
): Promise<{ synced: number; errors: string[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { synced: 0, errors: ["Not authenticated"] };

  const errors: string[] = [];
  let synced = 0;

  for (const item of items) {
    const { error } = await supabase.from("shopping_items").insert({
      household_id: item.householdId,
      user_id: user.id,
      cycle_id: item.cycleId,
      name: item.name,
      cost: item.cost,
      synced: true,
      local_id: item.localId,
      created_at: item.createdAt,
      synced_at: new Date().toISOString(),
    });

    if (error) {
      errors.push(`${item.name}: ${error.message}`);
    } else {
      synced++;
    }
  }

  return { synced, errors };
}

export async function getShoppingItems(householdId: string): Promise<ShoppingItemRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  return (data as ShoppingItemRow[]) || [];
}

export async function deleteShoppingItem(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("shopping_items").delete().eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function convertShoppingToExpense(
  itemIds: string[],
  cycleId: string,
  householdId: string,
  paidBy: string,
  type: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Fetch the shopping items
  const { data: items } = await supabase
    .from("shopping_items")
    .select("id, name, cost")
    .in("id", itemIds);

  if (!items || items.length === 0) return { error: "No items found." };

  const total = items.reduce((sum, i) => sum + i.cost, 0);
  const description = items.map((i) => i.name).join(", ");

  // Create the expense
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      cycle_id: cycleId,
      household_id: householdId,
      type,
      amount: total,
      paid_by: paidBy,
      description,
    })
    .select()
    .single();

  if (expenseError) return { error: expenseError.message };

  // Get active members for equal split
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .is("left_at", null);

  if (members && members.length > 0) {
    const shareAmount = Math.round((total / members.length) * 100) / 100;
    await supabase.from("expense_shares").insert(
      members.map((m) => ({
        expense_id: expense.id,
        user_id: m.user_id,
        share_amount: shareAmount,
      })),
    );
  }

  // Delete the shopping items that were converted
  await supabase.from("shopping_items").delete().in("id", itemIds);

  revalidatePath("/dashboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Custom expense types
// ---------------------------------------------------------------------------

export type CustomExpenseType = {
  id: string;
  household_id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export async function getDefaultExpenseTypes(): Promise<readonly string[]> {
  return ["electricity", "groceries", "drinking_water", "other"];
}

export async function getCustomExpenseTypes(householdId: string): Promise<CustomExpenseType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_expense_types")
    .select("*")
    .eq("household_id", householdId)
    .order("name");

  return (data as CustomExpenseType[]) || [];
}

export async function addCustomExpenseType(
  householdId: string,
  name: string,
): Promise<{ error: string | null; type?: CustomExpenseType }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Type name is required." };

  // Check if it conflicts with a default type
  const defaultTypes = await getDefaultExpenseTypes();
  if (defaultTypes.includes(trimmed.toLowerCase())) {
    return { error: "This type already exists as a default." };
  }

  const { data, error } = await supabase
    .from("custom_expense_types")
    .insert({
      household_id: householdId,
      name: trimmed,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "This type already exists." };
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { error: null, type: data as CustomExpenseType };
}

export async function deleteCustomExpenseType(
  typeId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("custom_expense_types").delete().eq("id", typeId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Personal view data (current user only)
// ---------------------------------------------------------------------------

export type PersonalSummary = {
  totalPaid: number;
  totalOwed: number;
  expenseCount: number;
  byType: Record<string, number>;
  byTypeOwed: Record<string, number>;
  recentExpenses: { id: string; type: string; amount: number; created_at: string }[];
  dailySpending: { date: string; paid: number; owed: number }[];
  topPayerBreakdown: { name: string; amount: number }[];
};

export async function getPersonalSummary(
  householdId: string,
  cycleId: string | null,
  userId: string,
): Promise<PersonalSummary> {
  const supabase = await createClient();

  const summary: PersonalSummary = {
    totalPaid: 0,
    totalOwed: 0,
    expenseCount: 0,
    byType: {},
    byTypeOwed: {},
    recentExpenses: [],
    dailySpending: [],
    topPayerBreakdown: [],
  };

  // Get expenses paid by this user
  let paidQuery = supabase
    .from("expenses")
    .select("id, type, amount, created_at")
    .eq("household_id", householdId)
    .eq("paid_by", userId);

  if (cycleId) paidQuery = paidQuery.eq("cycle_id", cycleId);

  const { data: paidExpenses } = await paidQuery.order("created_at", { ascending: false });

  // Daily aggregation
  const dailyMap: Record<string, { paid: number; owed: number }> = {};

  if (paidExpenses) {
    summary.expenseCount = paidExpenses.length;
    summary.recentExpenses = paidExpenses.slice(0, 5);
    for (const e of paidExpenses) {
      summary.totalPaid += e.amount;
      summary.byType[e.type] = (summary.byType[e.type] ?? 0) + e.amount;
      const day = e.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { paid: 0, owed: 0 };
      dailyMap[day].paid += e.amount;
    }
  }

  // Get this user's shares
  const shareQuery = supabase
    .from("expense_shares")
    .select("share_amount, expense:expenses(id, cycle_id, type)")
    .eq("user_id", userId);

  const { data: shares } = await shareQuery;

  if (shares) {
    for (const s of shares) {
      const exp = s.expense as unknown as { id: string; cycle_id: string; type: string } | null;
      if (!cycleId || exp?.cycle_id === cycleId) {
        summary.totalOwed += s.share_amount;
        if (exp?.type) {
          summary.byTypeOwed[exp.type] = (summary.byTypeOwed[exp.type] ?? 0) + s.share_amount;
        }
      }
    }
  }

  // Get paid-by-others breakdown (who paid for expenses this user owes)
  let shareDetailQuery = supabase
    .from("expense_shares")
    .select("share_amount, expense:expenses(paid_by, cycle_id)")
    .eq("user_id", userId);

  if (cycleId) shareDetailQuery = shareDetailQuery.eq("expense.cycle_id", cycleId);

  const { data: shareDetails } = await shareDetailQuery;

  if (shareDetails) {
    const payerMap: Record<string, number> = {};
    for (const s of shareDetails) {
      const exp = s.expense as unknown as { paid_by: string; cycle_id: string } | null;
      if (!exp) continue;
      // Skip expenses this user paid themselves
      if (exp.paid_by === userId) continue;
      payerMap[exp.paid_by] = (payerMap[exp.paid_by] ?? 0) + s.share_amount;
    }

    // Resolve names
    const payerIds = Object.keys(payerMap);
    if (payerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", payerIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? "Unknown"]));
      summary.topPayerBreakdown = Object.entries(payerMap)
        .map(([id, amount]) => ({ name: nameMap.get(id) ?? "Unknown", amount }))
        .sort((a, b) => b.amount - a.amount);
    }
  }

  // Get owed daily breakdown from expense_shares joined with expenses
  let owedDailyQuery = supabase
    .from("expense_shares")
    .select("share_amount, expense:expenses(created_at, cycle_id)")
    .eq("user_id", userId);

  if (cycleId) owedDailyQuery = owedDailyQuery.eq("expense.cycle_id", cycleId);

  const { data: owedDaily } = await owedDailyQuery;

  if (owedDaily) {
    for (const s of owedDaily) {
      const exp = s.expense as unknown as { created_at: string; cycle_id: string } | null;
      if (!exp) continue;
      const day = exp.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { paid: 0, owed: 0 };
      dailyMap[day].owed += s.share_amount;
    }
  }

  // Build sorted daily array
  summary.dailySpending = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return summary;
}
