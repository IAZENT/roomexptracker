"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getSettlements, markDebtSettled, type Settlement } from "./actions";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function SettlementDialog({
  cycleId,
  currency,
  open,
  onOpenChange,
}: {
  cycleId: string;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      getSettlements(cycleId).then(({ settlements, error }) => {
        setLoading(false);
        if (error) {
          toast.error(error);
        } else {
          setSettlements(settlements);
        }
      });
    }
  }, [open, cycleId]);

  const handleSettle = async (s: Settlement) => {
    const key = `${s.from.id}-${s.to.id}`;
    setSettling(key);
    const result = await markDebtSettled(cycleId, s.from.id, s.to.id);
    setSettling(null);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Debt marked as settled");
      setSettlements((prev) =>
        prev.map((st) =>
          st.from.id === s.from.id && st.to.id === s.to.id
            ? { ...st, settled: true }
            : st,
        ),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settlements</DialogTitle>
          <DialogDescription>
            Who owes whom based on this cycle&apos;s expenses.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : settlements.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Everyone is settled up!
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {settlements.map((s, i) => {
              const key = `${s.from.id}-${s.to.id}`;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{s.from.name}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-foreground">{s.to.name}</span>
                    <span className="text-muted-foreground">
                      {currency} {s.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {s.settled ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={settling === key}
                      onClick={() => handleSettle(s)}
                    >
                      {settling === key ? "..." : "Settle"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
