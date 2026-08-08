"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { upsertFixedBills, type FixedBillActionState, type FixedBill } from "./actions";

const initialState: FixedBillActionState = { error: null };

export function FixedBillsSettings({
  bills,
  currency,
}: {
  bills: FixedBill[];
  currency: string;
}) {
  const [state, action, pending] = useActionState(upsertFixedBills, initialState);

  const [rows, setRows] = useState<{ type: string; amount: string }[]>(() => {
    if (bills.length > 0) {
      return bills.map((b) => ({ type: b.type, amount: b.amount.toString() }));
    }
    return [{ type: "rent", amount: "" }];
  });

  const addRow = () => {
    setRows([...rows, { type: "", amount: "" }]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: "type" | "amount", value: string) => {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    setRows(next);
  };

  const handleSubmit = (formData: FormData) => {
    const billsObj: Record<string, number> = {};
    for (const row of rows) {
      const type = row.type.trim().toLowerCase();
      if (!type) continue;
      billsObj[type] = parseFloat(row.amount) || 0;
    }
    formData.set("bills", JSON.stringify(billsObj));
    action(formData);
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Fixed bills</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {rows.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex flex-col gap-1.5 flex-1">
                  {i === 0 && <Label>Type</Label>}
                  <Input
                    placeholder="e.g. internet, laundry"
                    value={row.type}
                    onChange={(e) => updateRow(i, "type", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  {i === 0 && <Label>Amount</Label>}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      className="pl-12"
                      value={row.amount}
                      onChange={(e) => updateRow(i, "amount", e.target.value)}
                    />
                  </div>
                </div>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRow(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit gap-1.5 text-muted-foreground"
            onClick={addRow}
          >
            <Plus className="h-4 w-4" />
            Add bill type
          </Button>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={pending}
          >
            {pending ? "Saving..." : "Save fixed bills"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
