import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShoppingMode } from "../shopping-mode";
import { ensureCurrentCycle, getCustomExpenseTypes } from "../actions";

export default async function ShoppingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role, household:households(id, cycle_end_day, currency)")
    .eq("user_id", user.id)
    .is("left_at", null)
    .single();

  if (!membership?.household) redirect("/dashboard");

  const hh = membership.household as unknown as { id: string; cycle_end_day: number; currency: string };

  // Ensure an open cycle exists
  const cycle = await ensureCurrentCycle(membership.household_id, hh.cycle_end_day);

  const customTypes = await getCustomExpenseTypes(membership.household_id);

  return (
    <ShoppingMode
      householdId={membership.household_id}
      cycleId={cycle?.id ?? null}
      currency={hh.currency}
      currentUserId={user.id}
      customTypes={customTypes}
    />
  );
}
