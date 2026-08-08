"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split an expense equally across every active member (amount / N, so
 *  everyone's "fair share" always stays equal), then redirect any covered
 *  member's share onto whoever covers them - independent of who actually
 *  paid for this particular expense. "A pays for B" means B never owes
 *  their own portion; A's total responsibility grows by B's portion
 *  instead. Who fronted the money for a given expense (paid_by) only
 *  matters for settlement direction, not for this division. */
function splitByCoverage(
  amount: number,
  allMembers: { user_id: string; pays_for: string[] | null }[],
): { user_id: string; share_amount: number }[] {
  const n = allMembers.length;
  if (n === 0) return [];

  const activeIds = new Set(allMembers.map((m) => m.user_id));

  // Map each covered member to whoever covers them (their "guardian").
  // A member only acts as a guardian if they've explicitly listed more
  // than just themselves in pays_for.
  const guardianOf = new Map<string, string>();
  for (const m of allMembers) {
    if (m.pays_for && m.pays_for.length > 1) {
      for (const coveredId of m.pays_for) {
        if (coveredId !== m.user_id && activeIds.has(coveredId)) {
          guardianOf.set(coveredId, m.user_id);
        }
      }
    }
  }

  const baseShare = amount / n;
  const totals = new Map<string, number>();
  for (const m of allMembers) {
    const owner = guardianOf.get(m.user_id) ?? m.user_id;
    totals.set(owner, (totals.get(owner) ?? 0) + baseShare);
  }

  // Round to 2 decimals, give remainder to whichever row is largest.
  const rounded = [...totals.entries()].map(([user_id, share]) => ({
    user_id,
    share_amount: Math.floor(share * 100) / 100,
  }));

  const totalRounded = rounded.reduce((sum, r) => sum + r.share_amount, 0);
  const remainder = Math.round((amount - totalRounded) * 100) / 100;
  if (remainder !== 0 && rounded.length > 0) {
    const largest = rounded.reduce((a, b) => (b.share_amount > a.share_amount ? b : a));
    largest.share_amount = Math.round((largest.share_amount + remainder) * 100) / 100;
  }

  return rounded;
}

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

  if (error) {
    // The RPC raises "Invalid or expired invite code" itself for a bad
    // code; surface the real message rather than a hardcoded generic one
    // so other failures (e.g. schema/permission errors) aren't masked.
    return { error: error.message, values };
  }

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

// ---------------------------------------------------------------------------
// Pays-for settings
// ---------------------------------------------------------------------------

export async function updatePaysFor(
  householdId: string,
  userId: string,
  paysFor: string[] | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Only owner can edit pays_for
  const { data: membership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .is("left_at", null)
    .single();

  if (membership?.role !== "owner") return { error: "Only the household owner can edit pays-for settings." };

  const { error } = await supabase
    .from("household_members")
    .update({ pays_for: paysFor })
    .eq("household_id", householdId)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

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
      await generateReceipts(householdId, openCycle.id);

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
) {
  const supabase = await createClient();

  // Get all active members with pays_for
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, pays_for")
    .eq("household_id", householdId)
    .is("left_at", null);

  if (!members || members.length === 0) return;

  // Calculate coverage for fixed bills split
  const totalCoverage = members.reduce((sum, m) => {
    return sum + (m.pays_for && m.pays_for.length > 0 ? m.pays_for.length : 1);
  }, 0);

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
    const memberCoverage = member.pays_for && member.pays_for.length > 0 ? member.pays_for.length : 1;

    const fixedBillsObj: Record<string, number> = {};
    for (const [type, amount] of latestBills) {
      fixedBillsObj[type] = Math.round((amount * memberCoverage / totalCoverage) * 100) / 100;
    }

    const expenseSharesArr: { expense_id: string; type: string; amount: number; share: number }[] = [];
    let totalFixed = 0;
    for (const amount of latestBills.values()) {
      totalFixed += (amount * memberCoverage / totalCoverage);
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

// ---------------------------------------------------------------------------
// Cycle close voting
// ---------------------------------------------------------------------------

export type CloseRequest = {
  id: string;
  cycle_id: string;
  requested_by: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type CloseApproval = {
  id: string;
  request_id: string;
  user_id: string;
  approved: boolean;
  created_at: string;
};

export async function getCloseRequestForCycle(
  cycleId: string,
): Promise<{ request: CloseRequest | null; approvals: CloseApproval[] }> {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("cycle_close_requests")
    .select("*")
    .eq("cycle_id", cycleId)
    .eq("status", "pending")
    .single();

  if (!request) return { request: null, approvals: [] };

  const { data: approvals } = await supabase
    .from("cycle_close_approvals")
    .select("*")
    .eq("request_id", request.id);

  return { request, approvals: approvals ?? [] };
}

export async function requestCycleClose(
  cycleId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: cycle } = await supabase
    .from("billing_cycles")
    .select("id, household_id, status")
    .eq("id", cycleId)
    .single();

  if (!cycle) return { error: "Cycle not found." };
  if (cycle.status !== "open") return { error: "Cycle is already closed." };

  // Check if a pending request already exists
  const { data: existing } = await supabase
    .from("cycle_close_requests")
    .select("id")
    .eq("cycle_id", cycleId)
    .eq("status", "pending")
    .single();

  if (existing) return { error: "A close request is already pending." };

  // Create the request
  const { data: request, error: reqError } = await supabase
    .from("cycle_close_requests")
    .insert({
      cycle_id: cycleId,
      requested_by: user.id,
      status: "pending",
    })
    .select()
    .single();

  if (reqError) return { error: reqError.message };

  // Auto-approve for the requester
  await supabase.from("cycle_close_approvals").insert({
    request_id: request.id,
    user_id: user.id,
    approved: true,
  });

  // Check if all members already approved (single-member household)
  const { count } = await supabase
    .from("household_members")
    .select("*", { count: "exact", head: true })
    .eq("household_id", cycle.household_id)
    .is("left_at", null);

  if (count === 1) {
    return executeCycleClose(cycleId, cycle.household_id);
  }

  revalidatePath("/dashboard");
  return { error: null };
}

export async function approveCycleClose(
  requestId: string,
  approved: boolean,
): Promise<{ error: string | null; fullyApproved?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Get the request
  const { data: request } = await supabase
    .from("cycle_close_requests")
    .select("id, cycle_id, status")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Request not found." };
  if (request.status !== "pending") return { error: "Request is no longer pending." };

  // Upsert the approval
  const { error: approvalError } = await supabase
    .from("cycle_close_approvals")
    .upsert(
      { request_id: requestId, user_id: user.id, approved },
      { onConflict: "request_id,user_id" },
    );

  if (approvalError) return { error: approvalError.message };

  if (!approved) {
    // Reject the whole request
    await supabase
      .from("cycle_close_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);
    revalidatePath("/dashboard");
    return { error: null };
  }

  // Check if all members approved
  const { data: cycle } = await supabase
    .from("billing_cycles")
    .select("household_id")
    .eq("id", request.cycle_id)
    .single();

  if (!cycle) return { error: "Cycle not found." };

  const { count: memberCount } = await supabase
    .from("household_members")
    .select("*", { count: "exact", head: true })
    .eq("household_id", cycle.household_id)
    .is("left_at", null);

  const { count: approvalCount } = await supabase
    .from("cycle_close_approvals")
    .select("*", { count: "exact", head: true })
    .eq("request_id", requestId)
    .eq("approved", true);

  if ((approvalCount ?? 0) >= (memberCount ?? 0)) {
    // All approved, close the cycle
    const result = await executeCycleClose(request.cycle_id, cycle.household_id);
    return { error: result.error, fullyApproved: true };
  }

  revalidatePath("/dashboard");
  return { error: null };
}

async function executeCycleClose(
  cycleId: string,
  householdId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("household_members")
    .select("*", { count: "exact", head: true })
    .eq("household_id", householdId)
    .is("left_at", null);

  const { error: closeError } = await supabase
    .from("billing_cycles")
    .update({
      status: "closed",
      member_count_snapshot: count || 0,
      closed_at: new Date().toISOString(),
    })
    .eq("id", cycleId);

  if (closeError) return { error: closeError.message };

  // Mark request as approved
  await supabase
    .from("cycle_close_requests")
    .update({ status: "approved" })
    .eq("cycle_id", cycleId)
    .eq("status", "pending");

  await generateReceipts(householdId, cycleId);

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
  role: string;
  pays_for: string[] | null;
};

export async function getActiveMembers(householdId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_members")
    .select("user_id, role, pays_for")
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
    role: m.role ?? "member",
    pays_for: m.pays_for ?? null,
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
  metadata: { name: string; cost: number }[] | null;
};

export type ExpenseShare = {
  expense_id: string;
  user_id: string;
  share_amount: number;
};

export type ExpenseActionState = {
  error: string | null;
  values?: { type?: string; amount?: string; description?: string; paidBy?: string; customShares?: string; items?: string };
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
  const itemsRaw = (formData.get("items") as string) || "";
  const values = {
    type,
    amount: amountRaw,
    description: description ?? undefined,
    paidBy,
    customShares: customSharesRaw,
    items: itemsRaw,
  };

  // Named items (e.g. "Milk", "Rice") are optional - each needs a name and a
  // positive cost. Skip incomplete rows (still-typing) rather than failing.
  let items: { name: string; cost: number }[] | null = null;
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(itemsRaw) as { name: string; cost: number }[];
      items = parsed.filter((i) => i.name?.trim() && i.cost > 0);
      if (items.length === 0) items = null;
    } catch {
      items = null;
    }
  }

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
      description: description ?? (items ? items.map((i) => i.name).join(", ") : null),
      metadata: items,
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

      // Validate custom shares sum to expense amount
      const totalShares = shares.reduce((sum, s) => sum + s.share_amount, 0);
      if (Math.abs(totalShares - amount) > 0.01) {
        return { error: `Custom shares (Rs ${totalShares.toFixed(2)}) must equal the expense amount (Rs ${amount.toFixed(2)})` };
      }
    } catch {
      // Fall back to equal split
    }
  }

  if (shares.length === 0) {
    // Split based on pays_for coverage
    const { data: members } = await supabase
      .from("household_members")
      .select("user_id, pays_for")
      .eq("household_id", cycle.household_id)
      .is("left_at", null);

    if (members && members.length > 0) {
      shares = splitByCoverage(amount, members);
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

  // Check cycle is open and user owns the expense (or is owner)
  const { data: expense } = await supabase
    .from("expenses")
    .select("paid_by, billing_cycles!inner(status), household_members!inner(role)")
    .eq("id", expenseId)
    .single();

  if (!expense) return { error: "Expense not found" };

  const cycleStatus = (expense.billing_cycles as unknown as { status: string })?.status;
  if (cycleStatus !== "open") {
    return { error: "Cannot delete expenses in a closed cycle" };
  }

  // Check ownership - only the payer can delete
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (expense.paid_by !== user.id) {
    return { error: "You can only delete your own expenses" };
  }

  // Delete shares first, then expense
  await supabase.from("expense_shares").delete().eq("expense_id", expenseId);
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateExpense(
  expenseId: string,
  data: {
    type?: string;
    amount?: number;
    paid_by?: string;
    description?: string | null;
    metadata?: { name: string; cost: number }[] | null;
  },
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Fetch current expense to check if amount changed, cycle status, and ownership
  const { data: current } = await supabase
    .from("expenses")
    .select("paid_by, amount, cycle_id, household_id, billing_cycles!inner(status)")
    .eq("id", expenseId)
    .single();

  if (!current) return { error: "Expense not found" };

  const cycleStatus = (current.billing_cycles as unknown as { status: string })?.status;
  if (cycleStatus !== "open") {
    return { error: "Cannot edit expenses in a closed cycle" };
  }

  // Check ownership - only the payer can edit
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (current.paid_by !== user.id) {
    return { error: "You can only edit your own expenses" };
  }

  const { error } = await supabase.from("expenses").update(data).eq("id", expenseId);
  if (error) return { error: error.message };

  // Recalculate shares if amount or payer changed (payer determines coverage)
  // Coverage doesn't depend on who paid, only recalc when amount changes.
  if (data.amount !== undefined && data.amount !== current.amount) {
    const { data: members } = await supabase
      .from("household_members")
      .select("user_id, pays_for")
      .eq("household_id", current.household_id)
      .is("left_at", null);

    if (members && members.length > 0) {
      const newShares = splitByCoverage(data.amount, members);
      await supabase.from("expense_shares").delete().eq("expense_id", expenseId);
      await supabase.from("expense_shares").insert(
        newShares.map((s) => ({
          expense_id: expenseId,
          user_id: s.user_id,
          share_amount: s.share_amount,
        })),
      );
    }
  }

  revalidatePath("/dashboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Settlements (who owes whom)
// ---------------------------------------------------------------------------

export type Settlement = {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
  settled: boolean;
};

export async function getSettlements(cycleId: string): Promise<{ settlements: Settlement[]; error: string | null }> {
  const supabase = await createClient();

  // Get all expenses for this cycle
  const { data: expenses, error: expErr } = await supabase
    .from("expenses")
    .select("id, paid_by, amount, household_id")
    .eq("cycle_id", cycleId);

  if (expErr) return { settlements: [], error: expErr.message };
  if (!expenses || expenses.length === 0) return { settlements: [], error: null };

  // Get shares only for these expenses
  const expenseIds = expenses.map((e) => e.id);
  const { data: allShares, error: shareErr } = await supabase
    .from("expense_shares")
    .select("expense_id, user_id, share_amount")
    .in("expense_id", expenseIds);

  if (shareErr) return { settlements: [], error: shareErr.message };

  const householdId = expenses[0].household_id;

  // Get all members with pays_for
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, profiles(full_name), pays_for")
    .eq("household_id", householdId)
    .is("left_at", null);

  if (!members) return { settlements: [], error: null };

  // Get fixed bills for this cycle and split based on pays_for coverage
  const { data: fixedBills } = await supabase
    .from("fixed_bills")
    .select("type, amount")
    .eq("household_id", householdId);

  // Calculate net balance for each person
  const balances: Record<string, number> = {};
  for (const m of members) {
    balances[m.user_id] = 0;
  }

  // Fixed bills split based on pays_for coverage
  if (fixedBills && fixedBills.length > 0 && members.length > 0) {
    const totalFixed = fixedBills.reduce((sum, b) => sum + b.amount, 0);
    const totalCoverage = members.reduce((sum, m) => {
      return sum + (m.pays_for && m.pays_for.length > 0 ? m.pays_for.length : 1);
    }, 0);
    for (const m of members) {
      const coverage = m.pays_for && m.pays_for.length > 0 ? m.pays_for.length : 1;
      const share = (coverage / totalCoverage) * totalFixed;
      balances[m.user_id] = (balances[m.user_id] ?? 0) - share;
    }
  }

  // For each expense: payer gets +amount, each person in shares owes -share_amount
  for (const exp of expenses) {
    balances[exp.paid_by] = (balances[exp.paid_by] ?? 0) + exp.amount;
    const shares = allShares.filter((s) => s.expense_id === exp.id);
    for (const share of shares) {
      balances[share.user_id] = (balances[share.user_id] ?? 0) - share.share_amount;
    }
  }

  // Simplify debts using greedy algorithm
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [userId, balance] of Object.entries(balances)) {
    if (balance < -0.01) {
      debtors.push({ id: userId, amount: Math.abs(balance) });
    } else if (balance > 0.01) {
      creditors.push({ id: userId, amount: balance });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    if (transfer > 0.01) {
      settlements.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: Math.round(transfer * 100) / 100,
      });
    }
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  // Check which are already settled
  const { data: settledData } = await supabase
    .from("settled_debts")
    .select("from_user_id, to_user_id")
    .eq("cycle_id", cycleId);

  const settledSet = new Set(
    (settledData ?? []).map((s) => `${s.from_user_id}-${s.to_user_id}`),
  );

  // Map user IDs to names
  const nameMap: Record<string, string> = {};
  for (const m of members) {
    nameMap[m.user_id] = (m.profiles as unknown as { full_name: string })?.full_name ?? "Unknown";
  }

  const result: Settlement[] = settlements.map((s) => ({
    from: { id: s.from, name: nameMap[s.from] ?? "Unknown" },
    to: { id: s.to, name: nameMap[s.to] ?? "Unknown" },
    amount: s.amount,
    settled: settledSet.has(`${s.from}-${s.to}`),
  }));

  return { settlements: result, error: null };
}

export async function markDebtSettled(
  cycleId: string,
  fromUserId: string,
  toUserId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("settled_debts").insert({
    cycle_id: cycleId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Balance history (net balance per member per closed cycle)
// ---------------------------------------------------------------------------

export type BalanceHistoryPoint = {
  cycleLabel: string;
  cycleId: string;
  members: Record<string, { name: string; balance: number }>;
};

export async function getBalanceHistory(householdId: string): Promise<BalanceHistoryPoint[]> {
  const supabase = await createClient();

  // Get all closed cycles
  const { data: cycles } = await supabase
    .from("billing_cycles")
    .select("id, cycle_start")
    .eq("household_id", householdId)
    .eq("status", "closed")
    .order("cycle_start", { ascending: true });

  if (!cycles || cycles.length === 0) return [];

  // Get members with pays_for
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, profiles(full_name), pays_for")
    .eq("household_id", householdId)
    .is("left_at", null);

  if (!members) return [];

  const nameMap: Record<string, string> = {};
  for (const m of members) {
    nameMap[m.user_id] = (m.profiles as unknown as { full_name: string })?.full_name ?? "Unknown";
  }

  const result: BalanceHistoryPoint[] = [];

  // Fetch all expenses and shares once (not per cycle)
  const cycleIds = cycles.map((c) => c.id);
  const [{ data: allExpenses }, { data: allShares }] = await Promise.all([
    supabase.from("expenses").select("id, cycle_id, paid_by, amount").in("cycle_id", cycleIds),
    supabase.from("expense_shares").select("expense_id, user_id, share_amount"),
  ]);

  if (!allExpenses || !allShares) return [];

  // Get fixed bills for this household (split based on pays_for coverage)
  const { data: fixedBills } = await supabase
    .from("fixed_bills")
    .select("amount")
    .eq("household_id", householdId);

  const totalFixed = fixedBills?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const totalCoverage = members.length > 0
    ? members.reduce((sum, m) => sum + (m.pays_for && m.pays_for.length > 0 ? m.pays_for.length : 1), 0)
    : 0;

  for (const cycle of cycles) {
    const expenses = allExpenses.filter((e) => e.cycle_id === cycle.id);

    const balances: Record<string, number> = {};
    for (const m of members) {
      const coverage = m.pays_for && m.pays_for.length > 0 ? m.pays_for.length : 1;
      const perPersonFixed = totalCoverage > 0 ? (coverage / totalCoverage) * totalFixed : 0;
      balances[m.user_id] = -perPersonFixed;
    }

    for (const exp of expenses) {
      balances[exp.paid_by] = (balances[exp.paid_by] ?? 0) + exp.amount;
      const expShares = allShares.filter((s) => s.expense_id === exp.id);
      for (const share of expShares) {
        balances[share.user_id] = (balances[share.user_id] ?? 0) - share.share_amount;
      }
    }

    const monthDate = new Date(cycle.cycle_start);
    const label = monthDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    const membersData: Record<string, { name: string; balance: number }> = {};
    for (const [userId, balance] of Object.entries(balances)) {
      membersData[userId] = {
        name: nameMap[userId] ?? "Unknown",
        balance: Math.round(balance * 100) / 100,
      };
    }

    result.push({
      cycleLabel: label,
      cycleId: cycle.id,
      members: membersData,
    });
  }

  return result;
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

  // Members' pays_for, so "who paid" credit reflects coverage: if the
  // payer covers someone else, that person is credited as having paid
  // their share too (e.g. Aashutosh pays for Arun -> Arun shows as
  // having paid half), not 100% attributed to whoever physically paid.
  const { data: membersForPayer } = await supabase
    .from("household_members")
    .select("user_id, pays_for")
    .eq("household_id", householdId)
    .is("left_at", null);
  const activePayerIds = new Set((membersForPayer ?? []).map((m) => m.user_id));
  const paysForByUser = new Map<string, string[] | null>(
    (membersForPayer ?? []).map((m) => [m.user_id, m.pays_for]),
  );

  if (expenses) {
    for (const e of expenses) {
      summary.totalByType[e.type] = (summary.totalByType[e.type] ?? 0) + e.amount;

      const payerPaysFor = paysForByUser.get(e.paid_by);
      const creditIds =
        payerPaysFor && payerPaysFor.length > 1
          ? payerPaysFor.filter((id) => activePayerIds.has(id))
          : [e.paid_by];
      const perCredit = e.amount / (creditIds.length || 1);
      for (const id of creditIds.length > 0 ? creditIds : [e.paid_by]) {
        summary.totalByPayer[id] = (summary.totalByPayer[id] ?? 0) + perCredit;
      }

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

  // Single query: get all cycles with their expense totals
  const { data: cycles } = await supabase
    .from("billing_cycles")
    .select("id, cycle_start, cycle_end, status, member_count_snapshot")
    .eq("household_id", householdId)
    .order("cycle_start", { ascending: true });

  if (!cycles) return [];

  // Single query: get all expenses for this household
  const { data: allExpenses } = await supabase
    .from("expenses")
    .select("cycle_id, type, amount")
    .eq("household_id", householdId);

  // Group expenses by cycle
  const expensesByCycle: Record<string, { type: string; amount: number }[]> = {};
  for (const e of allExpenses ?? []) {
    if (!expensesByCycle[e.cycle_id]) expensesByCycle[e.cycle_id] = [];
    expensesByCycle[e.cycle_id].push(e);
  }

  return cycles.map((cycle) => {
    const expenses = expensesByCycle[cycle.id] ?? [];
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byType: Record<string, number> = {};
    for (const e of expenses) {
      byType[e.type] = (byType[e.type] ?? 0) + e.amount;
    }
    return {
      id: cycle.id,
      cycle_start: cycle.cycle_start,
      cycle_end: cycle.cycle_end,
      status: cycle.status,
      total,
      byType,
      memberCount: cycle.member_count_snapshot ?? 0,
    };
  });
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
): Promise<{ synced: number; errors: string[]; idMap: Record<string, string> }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { synced: 0, errors: ["Not authenticated"], idMap: {} };

  const errors: string[] = [];
  let synced = 0;
  const idMap: Record<string, string> = {};

  for (const item of items) {
    const { data, error } = await supabase.from("shopping_items").insert({
      household_id: item.householdId,
      user_id: user.id,
      cycle_id: item.cycleId,
      name: item.name,
      cost: item.cost,
      synced: true,
      local_id: item.localId,
      created_at: item.createdAt,
      synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();

    if (error) {
      errors.push(`${item.name}: ${error.message}`);
    } else {
      synced++;
      idMap[item.localId] = data.id;
    }
  }

  return { synced, errors, idMap };
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

  // Create the expense with shopping items stored in metadata
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      cycle_id: cycleId,
      household_id: householdId,
      type,
      amount: total,
      paid_by: paidBy,
      description,
      metadata: items.map((i) => ({ name: i.name, cost: i.cost })),
    })
    .select()
    .single();

  if (expenseError) return { error: expenseError.message };

  // Get active members for coverage-based split
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, pays_for")
    .eq("household_id", householdId)
    .is("left_at", null);

  if (members && members.length > 0) {
    const newShares = splitByCoverage(total, members);
    await supabase.from("expense_shares").insert(
      newShares.map((s) => ({
        expense_id: expense.id,
        user_id: s.user_id,
        share_amount: s.share_amount,
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

  // Single query for all share data
  const shareQuery = supabase
    .from("expense_shares")
    .select("share_amount, expense:expenses(id, cycle_id, type, paid_by, created_at)")
    .eq("user_id", userId);

  const { data: shares } = await shareQuery;

  if (shares) {
    const payerMap: Record<string, number> = {};

    for (const s of shares) {
      const exp = s.expense as unknown as { id: string; cycle_id: string; type: string; paid_by: string; created_at: string } | null;
      if (!exp) continue;

      const matchesCycle = !cycleId || exp.cycle_id === cycleId;
      if (!matchesCycle) continue;

      // Totals
      summary.totalOwed += s.share_amount;
      if (exp.type) {
        summary.byTypeOwed[exp.type] = (summary.byTypeOwed[exp.type] ?? 0) + s.share_amount;
      }

      // Daily owed
      const day = exp.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { paid: 0, owed: 0 };
      dailyMap[day].owed += s.share_amount;

      // Payer breakdown (skip self)
      if (exp.paid_by !== userId) {
        payerMap[exp.paid_by] = (payerMap[exp.paid_by] ?? 0) + s.share_amount;
      }
    }

    // Resolve payer names
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

  // Build sorted daily array
  summary.dailySpending = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return summary;
}
