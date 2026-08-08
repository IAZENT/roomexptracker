"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { EXPENSE_TYPE_LABELS } from "@/lib/constants";
import type { Receipt } from "./actions";

export function ReceiptView({
  receipt,
  householdName,
  currency,
  cycleStart,
  cycleEnd,
  userName,
}: {
  receipt: Receipt;
  householdName: string;
  currency: string;
  cycleStart: string;
  cycleEnd: string;
  userName: string;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { fixed_bills, expense_shares } = receipt.itemized_breakdown;
  const totalFixed = Object.values(fixed_bills).reduce((s, v) => s + v, 0);
  const totalExpenses = expense_shares.reduce((s, e) => s + e.share, 0);

  // html-to-image and jspdf are only loaded when actually exporting, not
  // bundled into the main dashboard JS that every visit pays for.
  const handleExportPng = async () => {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(receiptRef.current, {
        backgroundColor: "#fefdfb",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `receipt-${householdName.replace(/\s+/g, "-")}-${cycleStart}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      const dataUrl = await toPng(receiptRef.current, {
        backgroundColor: "#fefdfb",
        pixelRatio: 2,
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((r) => { img.onload = r; });

      const pdf = new jsPDF({
        orientation: img.width > img.height ? "landscape" : "portrait",
        unit: "px",
        format: [img.width / 2, img.height / 2],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, img.width / 2, img.height / 2);
      pdf.save(`receipt-${householdName.replace(/\s+/g, "-")}-${cycleStart}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="mb-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportPng} disabled={exporting}>
          <Download className="mr-1.5 h-4 w-4" />
          PNG
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
          <Download className="mr-1.5 h-4 w-4" />
          PDF
        </Button>
      </div>

      <div
        ref={receiptRef}
        className="w-full max-w-[400px] rounded-xl border border-border bg-card p-6 text-sm"
      >
        <div className="mb-4 text-center">
          <h3 className="text-lg font-semibold text-foreground">{householdName}</h3>
          <p className="text-muted-foreground">
            Receipt for {userName}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(cycleStart).toLocaleDateString("en-US", { month: "long", day: "numeric" })}{" "}
            -{" "}
            {new Date(cycleEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        <div className="mb-3">
          <h4 className="mb-1 font-medium text-foreground">Fixed bills (split {receipt.itemized_breakdown.fixed_bills ? "equally" : ""})</h4>
          {Object.entries(fixed_bills).map(([type, amount]) => (
            <div key={type} className="flex justify-between py-0.5">
              <span className="capitalize text-muted-foreground">{type}</span>
              <span className="text-foreground">{currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-1 font-medium">
            <span className="text-muted-foreground">Fixed subtotal</span>
            <span className="text-foreground">{currency} {totalFixed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {expense_shares.length > 0 && (
          <div className="mb-3">
            <h4 className="mb-1 font-medium text-foreground">Expense shares</h4>
            {expense_shares.map((e, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span className="text-muted-foreground">
                  {EXPENSE_TYPE_LABELS[e.type] ?? e.type}
                  <span className="ml-1 text-xs">({currency} {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} total)</span>
                </span>
                <span className="text-foreground">{currency} {e.share.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-1 font-medium">
              <span className="text-muted-foreground">Expense subtotal</span>
              <span className="text-foreground">{currency} {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between rounded-lg bg-secondary px-3 py-2 text-base font-semibold">
          <span className="text-foreground">Total owed</span>
          <span className="text-primary">{currency} {receipt.total_owed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Generated on {new Date(receipt.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

export function ReceiptDialog({
  receipt,
  householdName,
  currency,
  cycleStart,
  cycleEnd,
  userName,
  trigger,
}: {
  receipt: Receipt;
  householdName: string;
  currency: string;
  cycleStart: string;
  cycleEnd: string;
  userName: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger}
      </div>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>
        <ReceiptView
          receipt={receipt}
          householdName={householdName}
          currency={currency}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          userName={userName}
        />
      </DialogContent>
    </Dialog>
  );
}
