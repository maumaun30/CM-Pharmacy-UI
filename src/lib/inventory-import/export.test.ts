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
it("round-trips to a plan with zero changes", () => {
  const csv = buildExportCsv(products, categories);
  const plan = buildImportPlan({
    text: csv,
    products,
    categories,
    mode: "delivery",
    updatePricing: true,
  });
  expect(plan.summary.changes).toBe(0);
  expect(plan.summary.errors).toBe(0);
  expect(plan.rows[0].status).toBe("unchanged");
});
