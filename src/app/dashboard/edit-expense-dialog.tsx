"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { EXPENSE_TYPE_LABELS } from "@/lib/constants";
import { updateExpense, deleteExpense, type Member, type CustomExpenseType } from "./actions";

type ItemRow = { name: string; cost: string };

export function EditExpenseDialog({
  expenseId,
  initialType,
  initialAmount,
  initialPaidBy,
  initialDescription,
  initialMetadata,
  members,
  currency,
  customTypes,
  open,
  onOpenChange,
}: {
  expenseId: string;
  initialType: string;
  initialAmount: number;
  initialPaidBy: string;
  initialDescription: string;
  initialMetadata: { name: string; cost: number }[] | null;
  members: Member[];
  currency: string;
  customTypes: CustomExpenseType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState(initialAmount.toString());
  const [paidBy, setPaidBy] = useState(initialPaidBy);
  const [description, setDescription] = useState(initialDescription);
  const [itemize, setItemize] = useState(!!initialMetadata && initialMetadata.length > 0);
  const [items, setItems] = useState<ItemRow[]>(
    initialMetadata && initialMetadata.length > 0
      ? initialMetadata.map((i) => ({ name: i.name, cost: i.cost.toString() }))
      : [{ name: "", cost: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const allTypes = [
    ...Object.entries(EXPENSE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    ...customTypes.map((t) => ({ value: t.name.toLowerCase(), label: t.name })),
  ];

  const validItems = items.filter((i) => i.name.trim() && parseFloat(i.cost) > 0);
  const itemsTotal = validItems.reduce((sum, i) => sum + parseFloat(i.cost), 0);

  const addItemRow = () => setItems((prev) => [...prev, { name: "", cost: "" }]);
  const removeItemRow = (index: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  const updateItemRow = (index: number, field: keyof ItemRow, value: string) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const handleSave = async () => {
    const parsedAmount = itemize ? itemsTotal : parseFloat(amount);
    if (!type || isNaN(parsedAmount) || parsedAmount <= 0 || !paidBy) return;
    if (itemize && validItems.length === 0) return;

    setSaving(true);
    const metadata = itemize
      ? validItems.map((i) => ({ name: i.name.trim(), cost: parseFloat(i.cost) }))
      : null;
    const result = await updateExpense(expenseId, {
      type,
      amount: parsedAmount,
      paid_by: paidBy,
      description: itemize ? (description || metadata!.map((i) => i.name).join(", ")) : (description || null),
      metadata,
    });
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Expense updated");
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteExpense(expenseId);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Expense deleted");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
          <DialogDescription>Update or delete this expense.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
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
            <Label>Amount</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currency}
              </span>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                className="pl-10"
                value={itemize ? itemsTotal.toFixed(2) : amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={itemize}
                readOnly={itemize}
              />
            </div>
            {itemize && (
              <p className="text-xs text-muted-foreground">Auto-calculated from items below.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Paid by</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger>
                <SelectValue />
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

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Input
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Itemize toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setItemize(!itemize)}
              className={`h-5 w-5 rounded border transition-colors ${
                itemize
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input bg-background"
              }`}
            >
              {itemize && (
                <svg className="mx-auto h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <Label className="text-sm">Add item names (e.g. groceries list)</Label>
          </div>

          {itemize && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => updateItemRow(i, "name", e.target.value)}
                    className="h-8 flex-1 text-sm"
                  />
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={item.cost}
                      onChange={(e) => updateItemRow(i, "cost", e.target.value)}
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItemRow(i)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    aria-label="Remove item"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItemRow} className="mt-1 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Button>
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className={itemsTotal > 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {currency} {itemsTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
            <Button
              className="flex-1"
              disabled={saving || (itemize && validItems.length === 0)}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
