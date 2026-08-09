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

  // Old products exports carry Brand Name etc. Unrecognized headers are
  // surfaced as unknown, not errors.
  it("surfaces unrecognized headers as unknown", () => {
    const r = resolveColumns(["SKU", "Brand Name", "Dosage"]);
    expect(r.present).toEqual(["SKU"]);
    expect(r.unknown).toEqual(["Brand Name", "Dosage"]);
    expect(r.ignored).toEqual([]);
  });

  it("classifies Current Stock as ignored, which is export-only reference", () => {
    const r = resolveColumns(["SKU", "Current Stock"]);
    expect(r.present).toEqual(["SKU"]);
    expect(r.ignored).toContain("Current Stock");
    expect(r.unknown).toEqual([]);
  });

  it("classifies a Qty Change alias shadowed by the canonical header as ignored", () => {
    const r = resolveColumns(["Qty Change", "Total Stock"]);
    expect(r.indexOf["Qty Change"]).toBe(0);
    expect(r.ignored).toContain("Total Stock");
    expect(r.unknown).toEqual([]);
  });

  it("classifies a second, unused Qty Change alias as ignored", () => {
    const r = resolveColumns(["SKU", "Total Stock", "Adjustment"]);
    expect(r.indexOf["Qty Change"]).toBe(1);
    expect(r.ignored).toContain("Adjustment");
  });

  it("classifies a duplicate canonical header as ignored", () => {
    const r = resolveColumns(["SKU", "SKU", "Name"]);
    expect(r.indexOf.SKU).toBe(0);
    expect(r.ignored).toContain("SKU");
    expect(r.unknown).toEqual([]);
  });

  it("treats an empty header as unknown", () => {
    const r = resolveColumns(["SKU", ""]);
    expect(r.unknown).toContain("");
  });

  it("matches headers case-insensitively and ignores surrounding space", () => {
    const r = resolveColumns([" sku ", "qty change"]);
    expect(r.indexOf.SKU).toBe(0);
    expect(r.indexOf["Qty Change"]).toBe(1);
  });
});
