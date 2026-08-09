import { describe, it, expect } from "vitest";
import { buildProductMatcher } from "@/lib/inventory-import/match";
import type { MatchableProduct } from "@/lib/inventory-import/types";

const make = (over: Partial<MatchableProduct>): MatchableProduct => ({
  id: 1,
  name: "Biogesic",
  sku: "BG1",
  barcode: "4800",
  cost: 10,
  price: 15,
  expiry_date: null,
  requires_prescription: false,
  track_inventory: true,
  status: "ACTIVE",
  category_id: 1,
  currentStock: 0,
  ...over,
});

const products = [
  make({ id: 1, sku: "BG1", barcode: "4800", name: "Biogesic" }),
  make({ id: 2, sku: "NZ1", barcode: "4801", name: "Neozep" }),
  make({ id: 3, sku: "SY5", barcode: null, name: '5" Syringe' }),
];

const match = buildProductMatcher(products);

it("matches on SKU first", () => {
  const r = match({ sku: "NZ1", barcode: "4800", name: "Biogesic" });
  expect(r.product?.id).toBe(2);
  expect(r.matchedBy).toBe("sku");
});

it("falls back to barcode when the SKU is unknown", () => {
  const r = match({ sku: "ZZZ", barcode: "4801", name: "" });
  expect(r.product?.id).toBe(2);
  expect(r.matchedBy).toBe("barcode");
});

it("falls back to name when SKU and barcode are unknown", () => {
  const r = match({ sku: "", barcode: "", name: "Neozep" });
  expect(r.product?.id).toBe(2);
  expect(r.matchedBy).toBe("name");
});

it("matches case-insensitively", () => {
  expect(match({ sku: "bg1", barcode: "", name: "" }).product?.id).toBe(1);
  expect(match({ sku: "", barcode: "", name: "NEOZEP" }).product?.id).toBe(2);
});

it("matches a name containing a quote", () => {
  const r = match({ sku: "", barcode: "", name: '5" Syringe' });
  expect(r.product?.id).toBe(3);
});

it("returns null when nothing matches", () => {
  const r = match({ sku: "NEW", barcode: "", name: "Unknown" });
  expect(r.product).toBeNull();
  expect(r.matchedBy).toBeNull();
});

it("ignores blank keys rather than matching a product with a blank field", () => {
  const r = match({ sku: "", barcode: "", name: "" });
  expect(r.product).toBeNull();
});

it("prefers barcode over name when they point at different products", () => {
  const r = match({ sku: "ZZZ", barcode: "4801", name: "Biogesic" });
  expect(r.product?.id).toBe(2);
  expect(r.matchedBy).toBe("barcode");
});

it("pins first-wins on a duplicate SKU", () => {
  const dupSkuProducts = [
    make({ id: 10, sku: "DUP1", barcode: "1000", name: "First Dup" }),
    make({ id: 11, sku: "DUP1", barcode: "1001", name: "Second Dup" }),
  ];
  const dupMatch = buildProductMatcher(dupSkuProducts);
  const r = dupMatch({ sku: "DUP1", barcode: "", name: "" });
  expect(r.product?.id).toBe(10);
});

it("pins first-wins on a duplicate name", () => {
  const dupNameProducts = [
    make({ id: 20, sku: "AA1", barcode: "2000", name: "Same Name" }),
    make({ id: 21, sku: "AA2", barcode: "2001", name: "Same Name" }),
  ];
  const dupMatch = buildProductMatcher(dupNameProducts);
  const r = dupMatch({ sku: "", barcode: "", name: "Same Name" });
  expect(r.product?.id).toBe(20);
});

it("returns no match without throwing when there are no products", () => {
  const emptyMatch = buildProductMatcher([]);
  const r = emptyMatch({ sku: "BG1", barcode: "4800", name: "Biogesic" });
  expect(r.product).toBeNull();
  expect(r.matchedBy).toBeNull();
});

it("matches a stored name with surrounding whitespace against a trimmed CSV name", () => {
  const whitespaceProducts = [make({ id: 30, sku: "WS1", barcode: "3000", name: "Biogesic " })];
  const wsMatch = buildProductMatcher(whitespaceProducts);
  const r = wsMatch({ sku: "", barcode: "", name: "Biogesic" });
  expect(r.product?.id).toBe(30);
});

it("does not match a whitespace-only SKU and falls through to barcode", () => {
  const r = match({ sku: "   ", barcode: "4801", name: "" });
  expect(r.product?.id).toBe(2);
  expect(r.matchedBy).toBe("barcode");
});
