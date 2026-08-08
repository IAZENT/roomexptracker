import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShoppingMode } from "../shopping-mode";

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

  // Get the current open cycle
  const { data: cycle } = await supabase
    .from("billing_cycles")
    .select("id")
    .eq("household_id", membership.household_id)
    .eq("status", "open")
    .single();

  return (
    <ShoppingMode
      householdId={membership.household_id}
      cycleId={cycle?.id ?? null}
      currency={hh.currency}
      currentUserId={user.id}
    />
  );
}
