import type { MatchableProduct } from "./types";

export interface MatchResult {
  product: MatchableProduct | null;
  matchedBy: "sku" | "barcode" | "name" | null;
}

/**
 * Builds a SKU > Barcode > Name matcher. Blank keys never match, so a row with
 * no SKU does not collide with a product whose SKU is empty.
 *
 * First product wins on a duplicate key.
 */
export const buildProductMatcher = (products: MatchableProduct[]) => {
  const bySku = new Map<string, MatchableProduct>();
  const byBarcode = new Map<string, MatchableProduct>();
  const byName = new Map<string, MatchableProduct>();

  for (const p of products) {
    const sku = p.sku?.trim().toLowerCase();
    const barcode = p.barcode?.trim().toLowerCase();
    const name = p.name?.trim().toLowerCase();
    if (sku && !bySku.has(sku)) bySku.set(sku, p);
    if (barcode && !byBarcode.has(barcode)) byBarcode.set(barcode, p);
    if (name && !byName.has(name)) byName.set(name, p);
  }

  return (row: {
    sku: string;
    barcode: string;
    name: string;
  }): MatchResult => {
    const sku = row.sku?.trim().toLowerCase();
    if (sku && bySku.has(sku)) {
      return { product: bySku.get(sku)!, matchedBy: "sku" };
    }
    const barcode = row.barcode?.trim().toLowerCase();
    if (barcode && byBarcode.has(barcode)) {
      return { product: byBarcode.get(barcode)!, matchedBy: "barcode" };
    }
    const name = row.name?.trim().toLowerCase();
    if (name && byName.has(name)) {
      return { product: byName.get(name)!, matchedBy: "name" };
    }
    return { product: null, matchedBy: null };
  };
};
