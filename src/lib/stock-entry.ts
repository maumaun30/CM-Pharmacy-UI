import type { ImportMode } from "@/lib/inventory-import/types";

/**
 * Validation for the products-page stock modal, which mirrors the CSV
 * importer's two modes: a delivery adds stock (`POST /stock/add`), an
 * adjustment applies a signed delta and demands a reason
 * (`POST /stock/adjust`). Kept out of the page component so the rules are
 * testable without rendering the dialog.
 */
export interface StockEntryInput {
  mode: ImportMode;
  /** Raw form value, still a string. */
  quantity: string;
  reason: string;
  /** Target branch: the session branch, or the one picked in the modal. */
  branchId: number | null;
}

export type StockEntryResult =
  | { ok: true; quantity: number }
  | { ok: false; error: string };

/**
 * The quantity alone, or null if it isn't usable in this mode. Lets the modal
 * preview the resulting stock while the rest of the form is still incomplete.
 */
export const parseEntryQuantity = (mode: ImportMode, quantity: string): number | null => {
  // Same rule as the importer's Qty Change column: parseInt would read "5abc"
  // as 5 and "3.7" as 3, turning a typo into a real stock movement.
  const raw = quantity.trim();
  if (!/^-?\d+$/.test(raw)) return null;
  const qty = parseInt(raw, 10);
  if (qty === 0) return null;
  if (mode === "delivery" && qty < 0) return null;
  return qty;
};

export const validateStockEntry = ({
  mode,
  quantity,
  reason,
  branchId,
}: StockEntryInput): StockEntryResult => {
  const raw = quantity.trim();
  if (!/^-?\d+$/.test(raw)) {
    return { ok: false, error: "Quantity must be a whole number" };
  }
  const qty = parseEntryQuantity(mode, raw);
  if (qty === null) {
    return {
      ok: false,
      error:
        mode === "delivery"
          ? "Quantity must be a positive number"
          : "Adjustment quantity can't be zero",
    };
  }

  if (mode === "adjustment" && reason.trim() === "") {
    return { ok: false, error: "Reason is required for an adjustment" };
  }

  // Admin in all-branches view has no session branch — the modal requires one.
  if (branchId == null) {
    return {
      ok: false,
      error:
        mode === "delivery"
          ? "Select a branch to receive the stock"
          : "Select a branch for this adjustment",
    };
  }

  return { ok: true, quantity: qty };
};

/**
 * Stock after applying a signed delta. Clamped at zero to match the API
 * (`Math.max(0, quantityBefore + quantity)`), so the modal preview and the
 * optimistic table patch never disagree with the server.
 */
export const resultingStock = (current: number, delta: number) =>
  Math.max(0, current + delta);
