"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS } from "@/lib/constants";
import { addExpense, type ExpenseActionState, type Member, type CustomExpenseType } from "./actions";

const initialState: ExpenseActionState = { error: null };

export function AddExpenseDialog({
  cycleId,
  members,
  currentUserId,
  currency,
  customTypes,
  hidePayer,
}: {
  cycleId: string;
  members: Member[];
  currentUserId: string;
  currency: string;
  customTypes: CustomExpenseType[];
  hidePayer?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addExpense, initialState);
  const [customSplit, setCustomSplit] = useState(false);
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCustomSplit(false);
      setCustomShares({});
    }
  };

  const totalCustom = Object.values(customShares).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0,
  );

  const customSharesJson = customSplit
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(customShares)
            .filter(([, v]) => v && parseFloat(v) > 0)
            .map(([k, v]) => [k, parseFloat(v)]),
        ),
      )
    : "";

  // Validate custom split sums to total
  const customSplitValid = !customSplit || (totalCustom > 0 && Math.abs(totalCustom - parseFloat(state.values?.amount ?? "0")) < 0.01);

  // Build full type list: defaults + custom
  const allTypes = [
    ...EXPENSE_TYPES,
    ...customTypes.map((t) => ({ value: t.name.toLowerCase(), label: t.name })),
  ];

  // Merge labels for display
  const typeLabels: Record<string, string> = { ...EXPENSE_TYPE_LABELS };
  for (const t of customTypes) {
    typeLabels[t.name.toLowerCase()] = t.name;
  }

  // Track previous state to detect success
  const prevStateRef = useRef(state);
  useEffect(() => {
    // Detect transition from pending/error to success
    if (prevStateRef.current !== state && state && !state.error && state.values?.type && state.values?.amount) {
      toast.success("Expense added", {
        description: `${typeLabels[state.values.type] ?? state.values.type} - ${currency} ${parseFloat(state.values.amount).toFixed(2)}`,
      });
      setOpen(false);
    }
    prevStateRef.current = state;
  }, [state, typeLabels, currency]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>
            Split evenly by default, or set custom amounts per person.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(formData) => {
            formData.set("customShares", customSharesJson);
            formData.set("cycleId", cycleId);
            if (hidePayer) {
              formData.set("paidBy", currentUserId);
            }
            action(formData);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-type">Type</Label>
            <Select name="type" defaultValue={state.values?.type}>
              <SelectTrigger id="expense-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {allTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currency}
              </span>
              <Input
                id="expense-amount"
                name="amount"
                type="number"
                min={0.01}
                step="0.01"
                placeholder="0"
                className="pl-12"
                defaultValue={state.values?.amount}
                required
              />
            </div>
          </div>

          {!hidePayer && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expense-paidBy">Paid by</Label>
              <Select name="paidBy" defaultValue={state.values?.paidBy ?? currentUserId}>
                <SelectTrigger id="expense-paidBy">
                  <SelectValue placeholder="Who paid?" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-desc">Description (optional)</Label>
            <Input
              id="expense-desc"
              name="description"
              placeholder="e.g. January electricity bill"
              defaultValue={state.values?.description}
            />
          </div>

          {/* Custom split toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomSplit(!customSplit)}
              className={`h-5 w-5 rounded border transition-colors ${
                customSplit
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input bg-background"
              }`}
            >
              {customSplit && (
                <svg className="mx-auto h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <Label className="text-sm">Custom split</Label>
          </div>

          {customSplit && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{m.full_name}</span>
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      className="h-8 pl-8 text-sm"
                      value={customShares[m.user_id] ?? ""}
                      onChange={(e) =>
                        setCustomShares((prev) => ({ ...prev, [m.user_id]: e.target.value }))
                      }
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className={totalCustom > 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {currency} {totalCustom.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={pending || (customSplit && !customSplitValid)}>
            {pending ? "Adding..." : "Add expense"}
          </Button>
          {customSplit && !customSplitValid && totalCustom > 0 && (
            <p className="text-xs text-destructive text-center">
              Custom split ({currency} {totalCustom.toFixed(2)}) must equal the expense amount ({currency} {parseFloat(state.values?.amount ?? "0").toFixed(2)})
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
