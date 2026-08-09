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
  // Recognized headers this import deliberately does not act on: the
  // export-only reference columns, a Qty Change alias shadowed by the
  // canonical header, and duplicate occurrences of a header already claimed.
  ignored: string[];
  // Headers this import does not recognize at all — e.g. Brand Name and
  // Dosage from an old products export. Surfaced to the user so an
  // old-format file explains itself instead of silently doing nothing.
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

  const ignored: string[] = [];
  const unknown: string[] = [];

  headers.forEach((h, i) => {
    if (claimed.has(i)) return;
    const n = norm(h);
    const isCanonicalDuplicate = CANONICAL_COLUMNS.some((c) => norm(c) === n);
    const isAlias = QTY_CHANGE_ALIASES.some((a) => norm(a) === n);
    const isIgnoredColumn = IGNORED_COLUMNS.some((c) => norm(c) === n);
    if (isCanonicalDuplicate || isAlias || isIgnoredColumn) {
      ignored.push(h);
    } else {
      unknown.push(h);
    }
  });

  return {
    indexOf,
    present: CANONICAL_COLUMNS.filter((c) => indexOf[c] !== undefined),
    ignored,
    unknown,
  };
};
