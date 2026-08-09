import dayjs from "dayjs";
import type {
  CategoryRef,
  CsvProductFields,
  FieldChange,
  MatchableProduct,
} from "./types";

export const parseBoolCell = (raw: string): boolean | undefined => {
  const v = raw?.trim().toLowerCase();
  if (v === "yes" || v === "true" || v === "1") return true;
  if (v === "no" || v === "false" || v === "0") return false;
  return undefined;
};

export const parseNumberCell = (raw: string): number | undefined => {
  const v = raw?.trim().replace(/,/g, "");
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const formatMoney = (n: number | null | undefined): string =>
  n == null ? "" : Number(n).toFixed(2);

const text = (v: string | null | undefined): string => (v ?? "").trim();

const day = (v: string | null | undefined): string => {
  const t = text(v);
  if (!t) return "";
  const d = dayjs(t);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
};

const bool = (v: boolean): string => (v ? "Yes" : "No");

const findCategory = (categories: CategoryRef[], name: string) =>
  categories.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());

/**
 * Compares the CSV cells present on a row against the stored product.
 *
 * Only keys present on `fields` are compared — an absent key means the column
 * was not in the CSV header, so there is nothing to say about it. A key set to
 * an empty string IS compared, because clearing a value deliberately is a real
 * edit.
 *
 * Every comparison is normalized. Raw string comparison would report every row
 * as changed (the export writes "10.00" where the API returns 10), which
 * silently disables the changes-only preview.
 */
export const diffProductFields = (
  fields: CsvProductFields,
  product: MatchableProduct,
  categories: CategoryRef[],
  options: { updatePricing: boolean },
): FieldChange[] => {
  const changes: FieldChange[] = [];
  const push = (field: string, from: string, to: string) => {
    if (from !== to) changes.push({ field, from, to });
  };

  if (fields.name !== undefined) {
    push("Name", text(product.name), text(fields.name));
  }
  if (fields.sku !== undefined) {
    push("SKU", text(product.sku), text(fields.sku));
  }
  if (fields.barcode !== undefined) {
    push("Barcode", text(product.barcode), text(fields.barcode));
  }
  if (fields.status !== undefined) {
    push("Status", product.status, fields.status);
  }
  if (fields.expiryDate !== undefined) {
    push("Expiry Date", day(product.expiry_date), day(fields.expiryDate));
  }
  if (fields.requiresPrescription !== undefined) {
    push(
      "Requires Prescription",
      bool(product.requires_prescription),
      bool(fields.requiresPrescription),
    );
  }
  if (fields.trackInventory !== undefined) {
    push(
      "Track Inventory",
      bool(product.track_inventory),
      bool(fields.trackInventory),
    );
  }
  // A blank Category cell says nothing about category — the same doctrine
  // text() applies to every other field. Without this guard it resolves to the
  // sentinel "new:" and the executor creates a category with an empty name.
  // Category is still required to CREATE a product; plan.ts enforces that
  // separately via its missing-field check.
  if (fields.categoryName !== undefined && text(fields.categoryName) !== "") {
    const stored = categories.find((c) => c.id === product.category_id);
    const incoming = findCategory(categories, fields.categoryName);
    // An unknown category name will be created on apply, so it is a change.
    const from = String(product.category_id);
    const to = incoming ? String(incoming.id) : `new:${text(fields.categoryName)}`;
    if (from !== to) {
      changes.push({
        field: "Category",
        from: stored?.name ?? "",
        to: text(fields.categoryName),
      });
    }
  }

  // Cost and Price are not sent when the pricing checkbox is off, so a
  // difference in them is not work to do and must not count as a change.
  if (options.updatePricing) {
    if (fields.cost !== undefined) {
      push("Cost", formatMoney(product.cost), formatMoney(fields.cost));
    }
    if (fields.price !== undefined) {
      push("Price", formatMoney(product.price), formatMoney(fields.price));
    }
  }

  return changes;
};
