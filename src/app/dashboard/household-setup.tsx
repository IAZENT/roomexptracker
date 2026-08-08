"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createHousehold, joinHousehold, type HouseholdActionState } from "./actions";

const initialState: HouseholdActionState = { error: null };

export function HouseholdSetup() {
  const [createState, createAction, creating] = useActionState(
    createHousehold,
    initialState,
  );
  const [joinState, joinAction, joining] = useActionState(
    joinHousehold,
    initialState,
  );

  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        Set up your household
      </h2>
      <p className="mt-1 mb-8 text-muted-foreground">
        Create a household for your room, or join one with an invite code
        from a roommate.
      </p>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Get started</CardTitle>
          <CardDescription>You&apos;ll need one household to track expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create">
            <TabsList className="mb-5 w-full">
              <TabsTrigger value="create" className="flex-1">
                Create household
              </TabsTrigger>
              <TabsTrigger value="join" className="flex-1">
                Join with code
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <form action={createAction} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="household-name">Household name</Label>
                  <Input
                    id="household-name"
                    name="name"
                    placeholder="e.g. Baneshwor Flat"
                    defaultValue={createState.values?.name}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cycle-end-day">
                    Cycle end day{" "}
                    <span className="font-normal text-muted-foreground">
                      (day of month your billing cycle ends)
                    </span>
                  </Label>
                  <Input
                    id="cycle-end-day"
                    name="cycleEndDay"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="e.g. 12"
                    defaultValue={createState.values?.cycleEndDay}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    name="currency"
                    defaultValue={createState.values?.currency ?? "NPR"}
                    required
                  />
                </div>
                {createState.error && (
                  <p className="text-sm text-destructive">{createState.error}</p>
                )}
                <Button
                  type="submit"
                  className="mt-2 h-11 w-full rounded-xl text-base"
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Create household"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="join">
              <form action={joinAction} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-code">Invite code</Label>
                  <Input
                    id="invite-code"
                    name="code"
                    placeholder="e.g. A1B2C3"
                    className="uppercase tracking-widest"
                    maxLength={6}
                    defaultValue={joinState.values?.code}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Ask whoever created the household for their invite code.
                  </p>
                </div>
                {joinState.error && (
                  <p className="text-sm text-destructive">{joinState.error}</p>
                )}
                <Button
                  type="submit"
                  className="mt-2 h-11 w-full rounded-xl text-base"
                  disabled={joining}
                >
                  {joining ? "Joining…" : "Join household"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
