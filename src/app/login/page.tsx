import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="Room Expenses"
            width={56}
            height={56}
            className="mx-auto mb-3 rounded-2xl"
            priority
          />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Room Expenses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track shared rent, bills, and expenses with your roommates.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
