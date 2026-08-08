const STORAGE_KEY = "roommate_shopping_items";

export type ShoppingItem = {
  localId: string;
  householdId: string;
  userId: string;
  cycleId: string | null;
  name: string;
  cost: number;
  synced: boolean;
  serverId?: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Local storage helpers
// ---------------------------------------------------------------------------

export function getLocalItems(): ShoppingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalItems(items: ShoppingItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full or private browsing -- warn user
    console.warn("Failed to save shopping items to localStorage");
  }
}

export function addLocalItem(
  item: Omit<ShoppingItem, "localId" | "synced" | "createdAt">,
): ShoppingItem | null {
  const items = getLocalItems();
  const newItem: ShoppingItem = {
    ...item,
    localId: crypto.randomUUID(),
    synced: false,
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return newItem;
  } catch {
    console.warn("Failed to save shopping item -- localStorage may be full");
    return null;
  }
}

export function removeLocalItem(localId: string) {
  const items = getLocalItems().filter((i) => i.localId !== localId);
  saveLocalItems(items);
}

export function markItemSynced(localId: string, serverId: string) {
  const items = getLocalItems();
  const item = items.find((i) => i.localId === localId);
  if (item) {
    item.synced = true;
    item.serverId = serverId;
  }
  saveLocalItems(items);
}

export function getUnsyncedItems(): ShoppingItem[] {
  return getLocalItems().filter((i) => !i.synced);
}

export function clearSyncedItems() {
  const items = getLocalItems().filter((i) => !i.synced);
  saveLocalItems(items);
}

export function getLocalTotal(): number {
  return getLocalItems().reduce((sum, i) => sum + i.cost, 0);
}
