"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp, type AuthState } from "./actions";

const initialState: AuthState = { error: null };

export function LoginForm() {
  const [loginState, loginAction, loginPending] = useActionState(
    signIn,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signUp,
    initialState,
  );

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Welcome</CardTitle>
        <CardDescription>Sign in or create an account to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="login" className="flex-1">
              Log in
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form action={loginAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
              {loginState.error && (
                <p className="text-sm text-destructive">{loginState.error}</p>
              )}
              <Button type="submit" className="mt-2 w-full" disabled={loginPending}>
                {loginPending ? "Logging in…" : "Log in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form action={signupAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-name">Full name</Label>
                <Input id="signup-name" name="fullName" required autoComplete="name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              {signupState.error && (
                <p className="text-sm text-destructive">{signupState.error}</p>
              )}
              {signupState.message && (
                <p className="text-sm text-muted-foreground">{signupState.message}</p>
              )}
              <Button type="submit" className="mt-2 w-full" disabled={signupPending}>
                {signupPending ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
