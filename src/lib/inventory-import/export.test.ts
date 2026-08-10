import { describe, it, expect } from "vitest";
import { buildExportRows, buildExportCsv } from "@/lib/inventory-import/export";
import { buildImportPlan } from "@/lib/inventory-import/plan";
import type { MatchableProduct, CategoryRef } from "@/lib/inventory-import/types";

const products: MatchableProduct[] = [
  {
    id: 1,
    name: "Biogesic",
    sku: "BG1",
    barcode: "4800",
    cost: 10,
    price: 15.5,
    expiry_date: "2027-01-31T00:00:00.000Z",
    requires_prescription: false,
    track_inventory: true,
    status: "ACTIVE",
    category_id: 3,
    currentStock: 40,
  },
];
const categories: CategoryRef[] = [{ id: 3, name: "Analgesic" }];

it("writes the canonical columns in order", () => {
  expect(Object.keys(buildExportRows(products, categories)[0])).toEqual([
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
    "Current Stock",
    "Qty Change",
    "Batch No",
  ]);
});

it("leaves the fill-in columns blank", () => {
  const row = buildExportRows(products, categories)[0];
  expect(row["Qty Change"]).toBe("");
  expect(row["Batch No"]).toBe("");
});

it("formats money to 2dp and dates to YYYY-MM-DD", () => {
  const row = buildExportRows(products, categories)[0];
  expect(row.Cost).toBe("10.00");
  expect(row.Price).toBe("15.50");
  expect(row["Expiry Date"]).toBe("2027-01-31");
});

it("writes booleans as Yes and No", () => {
  const row = buildExportRows(products, categories)[0];
  expect(row["Requires Prescription"]).toBe("No");
  expect(row["Track Inventory"]).toBe("Yes");
});

it("omits the four hidden fields entirely", () => {
  const keys = Object.keys(buildExportRows(products, categories)[0]);
  expect(keys).not.toContain("Brand Name");
  expect(keys).not.toContain("Generic Name");
  expect(keys).not.toContain("Dosage");
  expect(keys).not.toContain("Form");
});

// The round-trip guarantee: exporting and re-importing changes nothing.
// Widened beyond the single happy-path product because diffProductFields
// re-normalizes both sides symmetrically and would absorb formatting bugs
// (e.g. a missing .toFixed(2) or a raw ISO date) that a single plain product
// can't expose. These fixtures target the cases that could genuinely break:
// commas and quotes in text fields, INACTIVE status, an orphaned category,
// null barcode/expiry, and a zero cost.
it("round-trips to a plan with zero changes", () => {
  const roundTripProducts: MatchableProduct[] = [
    ...products,
    {
      id: 2,
      name: "Ibuprofen, 200mg",
      sku: "BG2",
      barcode: "4801",
      cost: 12,
      price: 18,
      expiry_date: "2027-06-30T00:00:00.000Z",
      requires_prescription: false,
      track_inventory: true,
      status: "ACTIVE",
      category_id: 3,
      currentStock: 20,
    },
    {
      id: 3,
      name: '5" Syringe',
      sku: "BG3",
      barcode: "4802",
      cost: 3,
      price: 5,
      expiry_date: "2027-06-30T00:00:00.000Z",
      requires_prescription: false,
      track_inventory: true,
      status: "ACTIVE",
      category_id: 3,
      currentStock: 100,
    },
    {
      id: 4,
      name: "Amoxicillin",
      sku: "BG4",
      barcode: "4803",
      cost: 8,
      price: 12,
      expiry_date: "2027-06-30T00:00:00.000Z",
      requires_prescription: true,
      track_inventory: true,
      status: "INACTIVE",
      category_id: 3,
      currentStock: 5,
    },
    {
      id: 5,
      name: "Orphaned Category Item",
      sku: "BG5",
      barcode: "4804",
      cost: 7,
      price: 9,
      expiry_date: "2027-06-30T00:00:00.000Z",
      requires_prescription: false,
      track_inventory: true,
      status: "ACTIVE",
      category_id: 999,
      currentStock: 15,
    },
    {
      id: 6,
      name: "No Barcode No Expiry",
      sku: "BG6",
      barcode: null,
      cost: 4,
      price: 6,
      expiry_date: null,
      requires_prescription: false,
      track_inventory: true,
      status: "ACTIVE",
      category_id: 3,
      currentStock: 8,
    },
    {
      id: 7,
      name: "Zero Cost Item",
      sku: "BG7",
      barcode: "4805",
      cost: 0,
      price: 1,
      expiry_date: "2027-06-30T00:00:00.000Z",
      requires_prescription: false,
      track_inventory: true,
      status: "ACTIVE",
      category_id: 3,
      currentStock: 30,
    },
  ];
  const csv = buildExportCsv(roundTripProducts, categories);
  const plan = buildImportPlan({
    text: csv,
    products: roundTripProducts,
    categories,
    mode: "delivery",
  });
  expect(plan.summary.changes).toBe(0);
  expect(plan.summary.errors).toBe(0);
  expect(plan.rows).toHaveLength(roundTripProducts.length);
  expect(plan.rows.every((row) => row.status === "unchanged")).toBe(true);
});
