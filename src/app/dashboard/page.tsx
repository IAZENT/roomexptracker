import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          No household yet
        </h2>
        <p className="mt-1 text-muted-foreground">
          Household creation/join flow coming next.
        </p>
      </main>
    </div>
  );
}
