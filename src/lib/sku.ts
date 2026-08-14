// SKU autofill for the products page.
//
// Format is `<PREFIX>-<NNNN>`, where PREFIX is derived from the category name
// and NNNN continues that prefix's existing run (highest number seen + 1).
// Generation is client-side against the already-loaded product list — the API's
// unique-SKU check on POST /products stays the authoritative guard, so a race
// between two users only costs a rejected save, never a duplicate.

const SEQUENCE_PAD = 4;
const PREFIX_LENGTH = 3;
const FALLBACK_PREFIX = "GEN";

/**
 * Category name -> 3-letter uppercase prefix. Non-letters are dropped so
 * "Over-the-counter" gives OVE and "Vitamins & Supplements" gives VIT. Short
 * names are padded with X ("Rx" -> RXX); a name with no letters falls back to GEN.
 */
export function skuPrefix(categoryName: string | null | undefined): string {
  const letters = (categoryName ?? "").replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (!letters) return FALLBACK_PREFIX;
  return letters.slice(0, PREFIX_LENGTH).padEnd(PREFIX_LENGTH, "X");
}

/**
 * Next free SKU for a category. Scans `existingSkus` for codes already using
 * this prefix, takes the highest sequence, and increments. Matching is
 * case-insensitive, and the result is re-checked against the full set so a
 * manually typed collision (e.g. "med-0008") still gets skipped.
 */
export function generateSku(
  categoryName: string | null | undefined,
  existingSkus: Iterable<string>,
): string {
  const prefix = skuPrefix(categoryName);
  const taken = new Set<string>();
  let highest = 0;

  const sequencePattern = new RegExp(`^${prefix}-(\\d+)$`);

  for (const sku of existingSkus) {
    if (!sku) continue;
    const normalized = sku.trim().toUpperCase();
    taken.add(normalized);

    const match = sequencePattern.exec(normalized);
    if (match) {
      const value = parseInt(match[1], 10);
      if (value > highest) highest = value;
    }
  }

  let next = highest + 1;
  let candidate = `${prefix}-${String(next).padStart(SEQUENCE_PAD, "0")}`;
  while (taken.has(candidate)) {
    next += 1;
    candidate = `${prefix}-${String(next).padStart(SEQUENCE_PAD, "0")}`;
  }
  return candidate;
}
