"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";
import {
  getLocalItems,
  addLocalItem,
  removeLocalItem,
  markItemSynced,
  getUnsyncedItems,
  clearSyncedItems,
  type ShoppingItem,
} from "@/lib/shopping-storage";
import { syncShoppingItems } from "./actions";

const EXPENSE_TYPES = [
  { value: "groceries", label: "Groceries" },
  { value: "drinking_water", label: "Drinking water" },
  { value: "other", label: "Other" },
] as const;

function getFilteredItems(householdId: string): ShoppingItem[] {
  return getLocalItems().filter((i) => i.householdId === householdId);
}

export function ShoppingMode({
  householdId,
  cycleId,
  currency,
  currentUserId,
}: {
  householdId: string;
  cycleId: string | null;
  currency: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ShoppingItem[]>(() =>
    typeof window !== "undefined" ? getFilteredItems(householdId) : [],
  );
  const [itemName, setItemName] = useState("");
  const [itemCost, setItemCost] = useState("");
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: string[] } | null>(null);
  const [showConvert, setShowConvert] = useState(false);
  const [convertType, setConvertType] = useState("groceries");
  const syncingRef = useRef(false);

  const refreshItems = useCallback(() => {
    setItems(getFilteredItems(householdId));
  }, [householdId]);

  const handleSync = useCallback(async () => {
    if (syncingRef.current) return;
    const unsynced = getUnsyncedItems().filter((i) => i.householdId === householdId);
    if (unsynced.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);
    setSyncResult(null);

    const result = await syncShoppingItems(
      unsynced.map((i) => ({
        localId: i.localId,
        name: i.name,
        cost: i.cost,
        householdId: i.householdId,
        cycleId: i.cycleId,
        createdAt: i.createdAt,
      })),
    );

    // Only mark items as synced if they were actually synced (not in errors)
    const errorNames = new Set(result.errors.map((e) => e.split(":")[0].trim()));
    for (const item of unsynced) {
      if (!errorNames.has(item.name)) {
        const serverId = result.idMap[item.localId];
        markItemSynced(item.localId, serverId ?? item.localId);
      }
    }

    clearSyncedItems();
    refreshItems();
    setSyncResult(result);
    setSyncing(false);
    syncingRef.current = false;
    // Auto-show convert dialog after successful sync
    if (result.synced > 0 && cycleId) {
      setShowConvert(true);
    }
  }, [householdId, refreshItems, cycleId]);

  // Track online/offline and auto-sync on reconnect
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      const unsynced = getUnsyncedItems().filter((i) => i.householdId === householdId);
      if (unsynced.length > 0) {
        handleSync();
      }
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [householdId, handleSync]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = itemName.trim();
    const cost = parseFloat(itemCost);
    if (!name || isNaN(cost) || cost <= 0) return;

    const added = addLocalItem({
      householdId,
      userId: currentUserId,
      cycleId,
      name,
      cost,
    });

    if (!added) {
      const { toast } = await import("sonner");
      toast.error("Failed to save item. Your device storage may be full.");
      return;
    }

    setItemName("");
    setItemCost("");
    refreshItems();
  };

  const handleRemoveItem = (localId: string) => {
    removeLocalItem(localId);
    refreshItems();
  };

  const unsyncedCount = items.filter((i) => !i.synced).length;
  const total = items.reduce((sum, i) => sum + i.cost, 0);

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Shopping mode
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-700">
                <Wifi className="h-3 w-3" />
                Online
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Add item form */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-4">
            <form onSubmit={handleAddItem} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Item name"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <div className="w-28">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      placeholder="Cost"
                      className="pl-10"
                      value={itemCost}
                      onChange={(e) => setItemCost(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={!itemName.trim() || !itemCost}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add item
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Items list */}
        {items.length > 0 && (
          <Card className="mt-4 border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">
                Items ({items.length})
              </CardTitle>
              <span className="text-sm font-semibold text-foreground">
                {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <div
                    key={item.localId}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      {!item.synced && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Not synced" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {currency} {item.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveItem(item.localId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {items.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {unsyncedCount > 0 && (
              <Button
                onClick={handleSync}
                disabled={syncing || !isOnline}
                className="w-full"
              >
                {syncing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="mr-1.5 h-4 w-4" />
                )}
                {syncing
                  ? "Syncing..."
                  : `Sync ${unsyncedCount} item${unsyncedCount !== 1 ? "s" : ""} to cloud`}
              </Button>
            )}

            {unsyncedCount === 0 && items.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-600" />
                  All items synced to cloud
                </div>
                {cycleId && (
                  <Button
                    className="w-full"
                    onClick={() => setShowConvert(true)}
                  >
                    Convert {items.length} item{items.length !== 1 ? "s" : ""} to expense
                  </Button>
                )}
              </div>
            )}

            {unsyncedCount > 0 && cycleId && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowConvert(true)}
              >
                Convert to expense
              </Button>
            )}
          </div>
        )}

        {/* Sync result */}
        {syncResult && (
          <Card className="mt-4 border-border shadow-sm">
            <CardContent className="pt-4">
              {syncResult.errors.length === 0 ? (
                <p className="text-sm text-green-700">
                  Synced {syncResult.synced} item{syncResult.synced !== 1 ? "s" : ""} successfully.
                </p>
              ) : (
                <div className="text-sm">
                  <p className="text-foreground">
                    Synced {syncResult.synced} item{syncResult.synced !== 1 ? "s" : ""}.
                  </p>
                  <p className="mt-1 text-destructive">
                    {syncResult.errors.length} item{syncResult.errors.length !== 1 ? "s" : ""} failed.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Offline info */}
        {!isOnline && (
          <Card className="mt-4 border-amber-200 bg-amber-50/50 shadow-sm">
            <CardContent className="pt-4">
              <p className="text-sm text-amber-800">
                You&apos;re offline. Items are saved locally and will sync
                automatically when you&apos;re back online.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Convert to expense dialog */}
      <Dialog open={showConvert} onOpenChange={setShowConvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to expense</DialogTitle>
            <DialogDescription>
              Turn your shopping list into an expense entry for the current cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Expense type</Label>
              <Select value={convertType} onValueChange={setConvertType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-semibold text-foreground">
                {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-muted-foreground"> ({items.length} items)</span>
            </div>
            <Button
              onClick={async () => {
                if (!cycleId) return;
                const unsynced = items.filter((i) => !i.synced);
                // First sync any unsynced items
                if (unsynced.length > 0 && isOnline) {
                  const syncResult = await syncShoppingItems(
                    unsynced.map((i) => ({
                      localId: i.localId,
                      name: i.name,
                      cost: i.cost,
                      householdId: i.householdId,
                      cycleId: i.cycleId,
                      createdAt: i.createdAt,
                    })),
                  );
                  // If some items failed sync, warn and stop
                  if (syncResult.errors.length > 0) {
                    const { toast } = await import("sonner");
                    toast.error(`Failed to sync ${syncResult.errors.length} item(s). Try again.`);
                    return;
                  }
                  // Mark synced locally
                  for (const item of unsynced) {
                    markItemSynced(item.localId, item.localId);
                  }
                  clearSyncedItems();
                  refreshItems();
                } else if (unsynced.length > 0 && !isOnline) {
                  const { toast } = await import("sonner");
                  toast.error("You're offline. Sync items first before converting to expense.");
                  return;
                }
                // Then convert all items to expense
                const refreshedItems = getFilteredItems(householdId);
                const allIds = refreshedItems.map((i) => i.serverId).filter((id): id is string => !!id);
                if (allIds.length === 0) {
                  const { toast } = await import("sonner");
                  toast.error("No synced items to convert. Sync first.");
                  return;
                }
                const { convertShoppingToExpense } = await import("./actions");
                const result = await convertShoppingToExpense(
                  allIds,
                  cycleId,
                  householdId,
                  currentUserId,
                  convertType,
                );
                if (!result.error) {
                  clearSyncedItems();
                  router.refresh();
                } else {
                  const { toast } = await import("sonner");
                  toast.error(result.error);
                }
              }}
            >
              Create expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
