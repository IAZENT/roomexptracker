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
import { EXPENSE_TYPE_LABELS } from "@/lib/constants";
import { updateExpense, deleteExpense, type Member, type CustomExpenseType } from "./actions";

export function EditExpenseDialog({
  expenseId,
  initialType,
  initialAmount,
  initialPaidBy,
  initialDescription,
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const allTypes = [
    ...Object.entries(EXPENSE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    ...customTypes.map((t) => ({ value: t.name.toLowerCase(), label: t.name })),
  ];

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!type || isNaN(parsedAmount) || parsedAmount <= 0 || !paidBy) return;

    setSaving(true);
    const result = await updateExpense(expenseId, {
      type,
      amount: parsedAmount,
      paid_by: paidBy,
      description: description || null,
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
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
              disabled={saving}
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
