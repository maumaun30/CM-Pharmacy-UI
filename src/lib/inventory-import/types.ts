export type ImportMode = "delivery" | "adjustment";

export type CanonicalColumn =
  | "SKU"
  | "Name"
  | "Category"
  | "Barcode"
  | "Cost"
  | "Price"
  | "Expiry Date"
  | "Requires Prescription"
  | "Track Inventory"
  | "Status"
  | "Qty Change"
  | "Batch No";

// The subset of a product the import logic needs. Deliberately narrower than
// the products page's Product interface so this module stays independent of it.
export interface MatchableProduct {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  cost: number;
  price: number;
  expiry_date?: string | null;
  requires_prescription: boolean;
  track_inventory: boolean;
  status: "ACTIVE" | "INACTIVE";
  category_id: number;
  currentStock: number;
}

export interface CategoryRef {
  id: number;
  name: string;
}

// Only keys whose header was present in the CSV are set. An absent key means
// "do not send", which is how the server is told to preserve the stored value.
export interface CsvProductFields {
  name?: string;
  sku?: string;
  categoryName?: string;
  barcode?: string;
  cost?: number;
  price?: number;
  expiryDate?: string | null;
  requiresPrescription?: boolean;
  trackInventory?: boolean;
  status?: "ACTIVE" | "INACTIVE";
}

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export type PlanRowStatus =
  | "new"
  | "update"
  | "stock-only"
  | "unchanged"
  | "error";

export interface PlanRow {
  lineNumber: number;
  sku: string;
  name: string;
  status: PlanRowStatus;
  errorMessage?: string;
  matchedProduct: MatchableProduct | null;
  matchedBy: "sku" | "barcode" | "name" | null;
  fields: CsvProductFields;
  changedFields: FieldChange[];
  qtyChange: number;
  batchNumber: string;
  currentStock: number | null;
  resultingStock: number | null;
}

export interface ImportSummary {
  rowsRead: number;
  changes: number;
  unchanged: number;
  errors: number;
}

export interface ImportPlan {
  rows: PlanRow[];
  presentColumns: CanonicalColumn[];
  // Headers in the file that this import does not act on. Surfaced in the
  // dialog so an old-format CSV explains itself instead of silently doing
  // nothing. See ResolvedColumns for the ignored/unknown distinction.
  ignoredColumns: string[];
  unknownColumns: string[];
  summary: ImportSummary;
}

export interface ImportResult {
  created: number;
  updated: number;
  stocked: number;
  failed: number;
  firstError: string;
}
