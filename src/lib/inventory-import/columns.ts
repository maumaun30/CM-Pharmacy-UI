import type { CanonicalColumn } from "./types";

export const CANONICAL_COLUMNS: CanonicalColumn[] = [
  "SKU",
  "Name",
  "Category",
  "Barcode",
  "Cost",
  "Price",
  "Expiry Date",
  "Requires Prescription",
  "Track Inventory",
  "Status",
  "Qty Change",
  "Batch No",
];

// Files exported by the old stock/add and stock/adjust pages used these names
// for what is now a single column. Accepted so held files keep working.
export const QTY_CHANGE_ALIASES = ["Total Stock", "Adjustment"];

// Written by the export as read-only reference; the import ignores it. Listed
// so it is not reported as an unknown header.
const IGNORED_COLUMNS = ["Current Stock", "ID"];

export interface ResolvedColumns {
  indexOf: Partial<Record<CanonicalColumn, number>>;
  present: CanonicalColumn[];
  unknown: string[];
}

const norm = (h: string) => h.trim().toLowerCase();

export const resolveColumns = (headers: string[]): ResolvedColumns => {
  const indexOf: Partial<Record<CanonicalColumn, number>> = {};
  const claimed = new Set<number>();

  for (const col of CANONICAL_COLUMNS) {
    const idx = headers.findIndex((h) => norm(h) === norm(col));
    if (idx >= 0) {
      indexOf[col] = idx;
      claimed.add(idx);
    }
  }

  // Aliases only fill in when the canonical header is absent.
  if (indexOf["Qty Change"] === undefined) {
    for (const alias of QTY_CHANGE_ALIASES) {
      const idx = headers.findIndex((h) => norm(h) === norm(alias));
      if (idx >= 0) {
        indexOf["Qty Change"] = idx;
        claimed.add(idx);
        break;
      }
    }
  }

  const unknown = headers.filter(
    (h, i) =>
      !claimed.has(i) && !IGNORED_COLUMNS.some((c) => norm(c) === norm(h)),
  );

  return {
    indexOf,
    present: CANONICAL_COLUMNS.filter((c) => indexOf[c] !== undefined),
    unknown,
  };
};
