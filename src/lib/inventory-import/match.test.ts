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
