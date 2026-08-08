import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthPanel } from "@/app/login/auth-panel";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="grid min-h-svh w-full lg:grid-cols-2">
      <AuthPanel />

      <div className="flex items-center justify-center bg-background px-6 py-16 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Image
              src="/logo-mark.png"
              alt="RoomMate"
              width={48}
              height={48}
              className="mx-auto mb-3"
              priority
            />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="mt-2 mb-10 text-muted-foreground">
            Join your flatmates and start tracking shared expenses.
          </p>

          <SignupForm />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
