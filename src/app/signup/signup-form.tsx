"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, type AuthState } from "@/app/login/actions";

const initialState: AuthState = { error: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-name">Full name</Label>
        <Input id="signup-name" name="fullName" placeholder="Your full name" required autoComplete="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-phone">
          Phone <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="signup-phone" name="phone" type="tel" placeholder="Your phone number" autoComplete="tel" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          placeholder="Enter your email"
          required
          autoComplete="email"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-password">Create password</Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          placeholder="Create a password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-confirm-password">Confirm password</Label>
        <Input
          id="signup-confirm-password"
          name="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
      <Button type="submit" className="mt-3 h-11 w-full rounded-xl text-base" disabled={pending}>
        {pending ? "Creating account…" : "Sign up"}
      </Button>
    </form>
  );
}
