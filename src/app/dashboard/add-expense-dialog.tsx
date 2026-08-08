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
import { Plus, X } from "lucide-react";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS } from "@/lib/constants";
import { addExpense, type ExpenseActionState, type CustomExpenseType } from "./actions";

const initialState: ExpenseActionState = { error: null };

type ItemRow = { name: string; cost: string };

export function AddExpenseDialog({
  cycleId,
  currentUserId,
  currency,
  customTypes,
}: {
  cycleId: string;
  currentUserId: string;
  currency: string;
  customTypes: CustomExpenseType[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addExpense, initialState);
  const [items, setItems] = useState<ItemRow[]>([{ name: "", cost: "" }]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setItems([{ name: "", cost: "" }]);
    }
  };

  const validItems = items.filter((i) => i.name.trim() && parseFloat(i.cost) > 0);
  const itemsTotal = validItems.reduce((sum, i) => sum + parseFloat(i.cost), 0);
  const itemsJson =
    validItems.length > 0
      ? JSON.stringify(validItems.map((i) => ({ name: i.name.trim(), cost: parseFloat(i.cost) })))
      : "";

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

  const addItemRow = () => setItems((prev) => [...prev, { name: "", cost: "" }]);
  const removeItemRow = (index: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  const updateItemRow = (index: number, field: keyof ItemRow, value: string) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

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
          <DialogDescription>Add each item and its cost.</DialogDescription>
        </DialogHeader>
        <form
          action={(formData) => {
            formData.set("items", itemsJson);
            formData.set("cycleId", cycleId);
            formData.set("amount", itemsTotal.toString());
            formData.set("paidBy", currentUserId);
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

          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => updateItemRow(i, "name", e.target.value)}
                  className="flex-1"
                />
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {currency}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={item.cost}
                    onChange={(e) => updateItemRow(i, "cost", e.target.value)}
                    className="pl-9"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItemRow(i)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  aria-label="Remove item"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItemRow} className="mt-1 gap-1.5 self-start">
              <Plus className="h-3.5 w-3.5" />
              Add item
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className={itemsTotal > 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
              {currency} {itemsTotal.toFixed(2)}
            </span>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={pending || validItems.length === 0}>
            {pending ? "Adding..." : "Add expense"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
