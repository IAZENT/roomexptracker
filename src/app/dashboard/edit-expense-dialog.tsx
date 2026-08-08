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
  initialPaidBy,
  initialMetadata,
  initialParticipantIds,
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
  initialParticipantIds: string[] | null;
  members: Member[];
  currency: string;
  customTypes: CustomExpenseType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = useState(initialType);
  const [items, setItems] = useState<ItemRow[]>(
    initialMetadata && initialMetadata.length > 0
      ? initialMetadata.map((i) => ({ name: i.name, cost: i.cost.toString() }))
      : [{ name: "", cost: "" }],
  );
  const [participants, setParticipants] = useState<Set<string>>(
    new Set(initialParticipantIds && initialParticipantIds.length > 0 ? initialParticipantIds : members.map((m) => m.user_id)),
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

  const toggleParticipant = (userId: string) =>
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const handleSave = async () => {
    if (!type || validItems.length === 0 || participants.size === 0) return;

    setSaving(true);
    const metadata = validItems.map((i) => ({ name: i.name.trim(), cost: parseFloat(i.cost) }));
    const result = await updateExpense(expenseId, {
      type,
      amount: itemsTotal,
      paid_by: initialPaidBy,
      description: metadata.map((i) => i.name).join(", "),
      metadata,
      participant_ids: participants.size < members.length ? [...participants] : null,
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

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Split among</Label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => toggleParticipant(m.user_id)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    participants.has(m.user_id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground border border-border hover:bg-secondary"
                  }`}
                >
                  {m.full_name}
                </button>
              ))}
            </div>
            {participants.size === 0 && (
              <p className="text-xs text-destructive">Select at least one person.</p>
            )}
          </div>

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
              disabled={saving || validItems.length === 0 || participants.size === 0}
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
