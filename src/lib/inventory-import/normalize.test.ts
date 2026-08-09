import { describe, it, expect } from "vitest";
import {
  diffProductFields,
  parseBoolCell,
  parseNumberCell,
} from "@/lib/inventory-import/normalize";
import type {
  MatchableProduct,
  CategoryRef,
} from "@/lib/inventory-import/types";

const product: MatchableProduct = {
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
};

const categories: CategoryRef[] = [
  { id: 3, name: "Analgesic" },
  { id: 4, name: "Antibiotic" },
];

const diff = (fields: Parameters<typeof diffProductFields>[0], updatePricing = true) =>
  diffProductFields(fields, product, categories, { updatePricing });

describe("parseBoolCell", () => {
  it("maps Yes and No", () => {
    expect(parseBoolCell("Yes")).toBe(true);
    expect(parseBoolCell("no")).toBe(false);
  });

  it("returns undefined for a blank cell", () => {
    expect(parseBoolCell("")).toBeUndefined();
  });
});

describe("parseNumberCell", () => {
  it("parses a plain number", () => {
    expect(parseNumberCell("10.00")).toBe(10);
  });

  it("strips thousands separators Excel adds", () => {
    expect(parseNumberCell("1,250.50")).toBe(1250.5);
  });

  it("returns undefined for a blank or unparseable cell", () => {
    expect(parseNumberCell("")).toBeUndefined();
    expect(parseNumberCell("abc")).toBeUndefined();
  });
});

describe("diffProductFields — no false positives", () => {
  it('treats "10.00" as equal to 10', () => {
    expect(diff({ cost: 10 })).toEqual([]);
  });

  it("compares money to 2 decimal places", () => {
    expect(diff({ price: 15.499 })).toEqual([]);
  });

  it("compares an ISO timestamp to a YYYY-MM-DD cell", () => {
    expect(diff({ expiryDate: "2027-01-31" })).toEqual([]);
  });

  it("treats an empty string as equal to null", () => {
    expect(diff({ barcode: "4800" })).toEqual([]);
  });

  it("compares category by resolved id, case-insensitively", () => {
    expect(diff({ categoryName: "analgesic" })).toEqual([]);
  });

  it("ignores whitespace around text", () => {
    expect(diff({ name: "  Biogesic  " })).toEqual([]);
  });

  it("reports nothing when no fields are present", () => {
    expect(diff({})).toEqual([]);
  });
});

describe("diffProductFields — no false negatives", () => {
  it("detects a name edit", () => {
    expect(diff({ name: "Biogesic Forte" })).toEqual([
      { field: "Name", from: "Biogesic", to: "Biogesic Forte" },
    ]);
  });

  it("detects a price edit", () => {
    expect(diff({ price: 16 })).toEqual([
      { field: "Price", from: "15.50", to: "16.00" },
    ]);
  });

  it("detects a category change", () => {
    expect(diff({ categoryName: "Antibiotic" })).toEqual([
      { field: "Category", from: "Analgesic", to: "Antibiotic" },
    ]);
  });

  it("detects a boolean flip", () => {
    expect(diff({ requiresPrescription: true })).toEqual([
      { field: "Requires Prescription", from: "No", to: "Yes" },
    ]);
  });

  it("detects deliberately clearing a value", () => {
    expect(diff({ barcode: "" })).toEqual([
      { field: "Barcode", from: "4800", to: "" },
    ]);
  });

  it("reports every changed field at once", () => {
    expect(diff({ name: "X", status: "INACTIVE" })).toHaveLength(2);
  });
});

describe("diffProductFields — pricing checkbox gate", () => {
  // Cost and Price are not sent when the checkbox is off, so a row differing
  // only in price has no work to do and must not be reported as changed.
  it("ignores cost and price when updatePricing is false", () => {
    expect(diff({ cost: 99, price: 99 }, false)).toEqual([]);
  });

  it("still reports other fields when updatePricing is false", () => {
    expect(diff({ cost: 99, name: "X" }, false)).toEqual([
      { field: "Name", from: "Biogesic", to: "X" },
    ]);
  });
});
