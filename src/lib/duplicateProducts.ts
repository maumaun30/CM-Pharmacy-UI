/**
 * Near-duplicate detection for the product form.
 *
 * The API already rejects a repeated SKU, so the case this covers is the other
 * one: the same product entered a second time under a fresh SKU. The check is
 * advisory only — a match warns, it never blocks the save, because legitimately
 * distinct rows (different supplier, different pack size) can share a name.
 */

export interface DuplicateCandidate {
  id: number;
  name: string;
  sku: string;
  brand_name?: string | null;
}

/** Lowercase, collapse runs of whitespace, trim. Null/undefined become "". */
const normalize = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Below this a name is still being typed and every match would be noise. */
const MIN_NAME_LENGTH = 2;

/**
 * Products whose name matches `name`, keyed on name + brand.
 *
 * Brand only *separates* rows when both sides actually carry one: the product
 * form has no brand input (brand_name arrives via CSV import), so a blank brand
 * on either side is treated as "unknown" and matches anything. Pass `excludeId`
 * when editing so a product never flags itself.
 */
export function findDuplicateProducts<T extends DuplicateCandidate>(
  products: T[],
  name: string,
  brandName?: string | null,
  excludeId?: number,
): T[] {
  const targetName = normalize(name);
  if (targetName.length < MIN_NAME_LENGTH) return [];

  const targetBrand = normalize(brandName);

  return products.filter((product) => {
    if (product.id === excludeId) return false;
    if (normalize(product.name) !== targetName) return false;

    const candidateBrand = normalize(product.brand_name);
    if (!targetBrand || !candidateBrand) return true;
    return candidateBrand === targetBrand;
  });
}
