import { describe, expect, it } from "vitest";
import { findDuplicateProducts } from "./duplicateProducts";

const catalog = [
  { id: 1, name: "Biogesic 500mg", sku: "MED-0001", brand_name: "Unilab" },
  { id: 2, name: "Paracetamol", sku: "MED-0002", brand_name: null },
  { id: 3, name: "Amoxicillin 250mg", sku: "MED-0003", brand_name: "RiteMed" },
];

describe("findDuplicateProducts", () => {
  it("matches a product typed again under a different SKU", () => {
    const hits = findDuplicateProducts(catalog, "Paracetamol");
    expect(hits.map((p) => p.sku)).toEqual(["MED-0002"]);
  });

  it("ignores case and extra whitespace", () => {
    const hits = findDuplicateProducts(catalog, "  biogesic   500MG ");
    expect(hits.map((p) => p.id)).toEqual([1]);
  });

  it("returns nothing for a genuinely new product", () => {
    expect(findDuplicateProducts(catalog, "Cetirizine 10mg")).toEqual([]);
  });

  it("separates two brands of the same product name", () => {
    const hits = findDuplicateProducts(catalog, "Biogesic 500mg", "RiteMed");
    expect(hits).toEqual([]);
  });

  it("matches when either side has no brand, since brand is unset on the form", () => {
    expect(findDuplicateProducts(catalog, "Biogesic 500mg")).toHaveLength(1);
    expect(findDuplicateProducts(catalog, "Paracetamol", "Unilab")).toHaveLength(1);
  });

  it("excludes the product being edited", () => {
    expect(findDuplicateProducts(catalog, "Paracetamol", null, 2)).toEqual([]);
  });

  it("stays quiet until the name is worth checking", () => {
    expect(findDuplicateProducts(catalog, "")).toEqual([]);
    expect(findDuplicateProducts(catalog, " P ")).toEqual([]);
  });

  it("survives null names and brands in the catalog", () => {
    const messy = [
      { id: 9, name: null as unknown as string, sku: "X-1", brand_name: null },
      ...catalog,
    ];
    expect(() => findDuplicateProducts(messy, "Paracetamol")).not.toThrow();
    expect(findDuplicateProducts(messy, "Paracetamol")).toHaveLength(1);
  });
});
