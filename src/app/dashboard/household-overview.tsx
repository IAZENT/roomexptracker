import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Household = {
  id: string;
  name: string;
  cycle_end_day: number;
  currency: string;
  invite_code: string | null;
};

export function HouseholdOverview({
  household,
  role,
}: {
  household: Household;
  role: string;
}) {
  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex items-center gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {household.name}
        </h2>
        <Badge variant="secondary" className="capitalize">
          {role}
        </Badge>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Household details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Billing cycle ends</span>
            <span className="font-medium text-foreground">
              Day {household.cycle_end_day} of each month
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Currency</span>
            <span className="font-medium text-foreground">{household.currency}</span>
          </div>

          {role === "owner" ? (
            <div className="mt-2 rounded-xl bg-secondary px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Invite code - share with roommates so they can join
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tracking-[0.3em] text-primary">
                {household.invite_code}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Ask the household owner for the invite code to add more roommates.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        Cycle tracking, expenses, and receipts are coming next.
      </p>
    </div>
  );
}
