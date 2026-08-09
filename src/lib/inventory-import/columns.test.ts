import { describe, it, expect } from "vitest";
import { resolveColumns } from "@/lib/inventory-import/columns";

describe("resolveColumns", () => {
  it("maps canonical headers to their index", () => {
    const r = resolveColumns(["SKU", "Name", "Qty Change"]);
    expect(r.indexOf.SKU).toBe(0);
    expect(r.indexOf["Qty Change"]).toBe(2);
    expect(r.present).toEqual(["SKU", "Name", "Qty Change"]);
  });

  it("accepts Total Stock as an alias for Qty Change", () => {
    const r = resolveColumns(["SKU", "Total Stock"]);
    expect(r.indexOf["Qty Change"]).toBe(1);
    expect(r.present).toContain("Qty Change");
  });

  it("accepts Adjustment as an alias for Qty Change", () => {
    const r = resolveColumns(["SKU", "Adjustment"]);
    expect(r.indexOf["Qty Change"]).toBe(1);
  });

  it("prefers Qty Change when an alias is also present", () => {
    const r = resolveColumns(["SKU", "Adjustment", "Qty Change"]);
    expect(r.indexOf["Qty Change"]).toBe(2);
  });

  // Old products exports carry Brand Name etc. Unknown headers are ignored,
  // not errors.
  it("ignores unknown headers", () => {
    const r = resolveColumns(["SKU", "Brand Name", "Dosage"]);
    expect(r.present).toEqual(["SKU"]);
    expect(r.unknown).toEqual(["Brand Name", "Dosage"]);
  });

  it("ignores Current Stock, which is export-only reference", () => {
    const r = resolveColumns(["SKU", "Current Stock"]);
    expect(r.present).toEqual(["SKU"]);
    expect(r.unknown).toEqual([]);
  });

  it("matches headers case-insensitively and ignores surrounding space", () => {
    const r = resolveColumns([" sku ", "qty change"]);
    expect(r.indexOf.SKU).toBe(0);
    expect(r.indexOf["Qty Change"]).toBe(1);
  });
});
