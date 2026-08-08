// Shared constants for expense types, colors, and labels.
// Used across dashboard, charts, receipts, and personal view.

export const EXPENSE_TYPES = [
  { value: "electricity", label: "Electricity" },
  { value: "groceries", label: "Groceries" },
  { value: "drinking_water", label: "Drinking water" },
  { value: "other", label: "Other" },
] as const;

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  electricity: "Electricity",
  groceries: "Groceries",
  drinking_water: "Drinking water",
  other: "Other",
  rent: "Rent",
  water: "Water",
  garbage: "Garbage",
};

export const CATEGORY_COLORS: Record<string, string> = {
  electricity: "oklch(0.58 0.13 40)",
  groceries: "oklch(0.6 0.08 200)",
  drinking_water: "oklch(0.65 0.1 140)",
  other: "oklch(0.7 0.12 90)",
  rent: "oklch(0.5 0.02 60)",
  water: "oklch(0.58 0.13 40)",
  garbage: "oklch(0.6 0.08 200)",
};

export const MEMBER_COLORS = [
  "oklch(0.58 0.13 40)",
  "oklch(0.6 0.08 200)",
  "oklch(0.65 0.1 140)",
  "oklch(0.7 0.12 90)",
  "oklch(0.5 0.02 60)",
  "oklch(0.55 0.15 280)",
  "oklch(0.65 0.15 160)",
  "oklch(0.7 0.08 50)",
];
