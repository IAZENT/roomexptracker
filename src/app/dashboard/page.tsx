import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";
import { HouseholdSetup } from "./household-setup";
import { HouseholdOverview } from "./household-overview";

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

  return (
    <div className="min-h-svh bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Image src="/logo-mark.png" alt="" width={28} height={28} className="rounded-lg" />
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            RoomMate
          </h1>
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            Log out
          </Button>
        </form>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16">
        {active?.household ? (
          <HouseholdOverview household={active.household} role={active.role} />
        ) : (
          <HouseholdSetup />
        )}
      </main>
    </div>
  );
}
