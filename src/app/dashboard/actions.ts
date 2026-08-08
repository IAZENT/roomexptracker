"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HouseholdActionState = {
  error: string | null;
  // Echoed back so forms can restore them after an error — React resets
  // uncontrolled <form action> fields after every submission (success or
  // failure) unless defaultValue is re-supplied.
  values?: { name?: string; cycleEndDay?: string; currency?: string; code?: string };
};

const initial: HouseholdActionState = { error: null };
export { initial as initialHouseholdActionState };

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
