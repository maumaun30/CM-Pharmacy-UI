import { describe, it, expect } from "vitest";
import { validateStockEntry, parseEntryQuantity, resultingStock } from "@/lib/stock-entry";

const base = { branchId: 1, reason: "" };

describe("validateStockEntry — delivery", () => {
  it("accepts a positive whole quantity", () => {
    const r = validateStockEntry({ ...base, mode: "delivery", quantity: "12" });
    expect(r).toEqual({ ok: true, quantity: 12 });
  });

  it("rejects zero", () => {
    const r = validateStockEntry({ ...base, mode: "delivery", quantity: "0" });
    expect(r).toEqual({ ok: false, error: "Quantity must be a positive number" });
  });

  it("rejects a negative quantity", () => {
    const r = validateStockEntry({ ...base, mode: "delivery", quantity: "-3" });
    expect(r).toEqual({ ok: false, error: "Quantity must be a positive number" });
  });

  it("does not need a reason", () => {
    const r = validateStockEntry({ ...base, mode: "delivery", quantity: "5", reason: "" });
    expect(r.ok).toBe(true);
  });

  it("requires a branch", () => {
    const r = validateStockEntry({ ...base, mode: "delivery", quantity: "5", branchId: null });
    expect(r).toEqual({ ok: false, error: "Select a branch to receive the stock" });
  });
});

describe("validateStockEntry — adjustment", () => {
  it("accepts a negative quantity with a reason", () => {
    const r = validateStockEntry({
      mode: "adjustment",
      quantity: "-5",
      reason: "Physical count correction",
      branchId: 1,
    });
    expect(r).toEqual({ ok: true, quantity: -5 });
  });

  it("accepts a positive quantity with a reason", () => {
    const r = validateStockEntry({
      mode: "adjustment",
      quantity: "4",
      reason: "Found in back room",
      branchId: 1,
    });
    expect(r).toEqual({ ok: true, quantity: 4 });
  });

  it("rejects zero", () => {
    const r = validateStockEntry({ ...base, mode: "adjustment", quantity: "0", reason: "x" });
    expect(r).toEqual({ ok: false, error: "Adjustment quantity can't be zero" });
  });

  it("requires a reason", () => {
    const r = validateStockEntry({ ...base, mode: "adjustment", quantity: "-5", reason: "   " });
    expect(r).toEqual({ ok: false, error: "Reason is required for an adjustment" });
  });

  it("requires a branch", () => {
    const r = validateStockEntry({
      mode: "adjustment",
      quantity: "-5",
      reason: "x",
      branchId: null,
    });
    expect(r).toEqual({ ok: false, error: "Select a branch for this adjustment" });
  });
});

// Same rule as the CSV importer's Qty Change column: a half-parsed cell like
// "5abc" would silently become a real stock movement, so reject it outright.
describe("validateStockEntry — quantity parsing", () => {
  it.each(["", "  ", "abc", "5abc", "3.7", "+"])("rejects %o", (quantity) => {
    const r = validateStockEntry({ ...base, mode: "delivery", quantity });
    expect(r).toEqual({ ok: false, error: "Quantity must be a whole number" });
  });

  it("ignores surrounding whitespace", () => {
    const r = validateStockEntry({ ...base, mode: "delivery", quantity: " 7 " });
    expect(r).toEqual({ ok: true, quantity: 7 });
  });
});

// The modal previews the resulting stock while the user is still typing, so it
// needs the quantity alone — a missing reason must not blank out the preview.
describe("parseEntryQuantity", () => {
  it("returns a delivery quantity", () => {
    expect(parseEntryQuantity("delivery", "12")).toBe(12);
  });

  it("returns a negative adjustment quantity", () => {
    expect(parseEntryQuantity("adjustment", "-5")).toBe(-5);
  });

  it("returns null for a negative delivery", () => {
    expect(parseEntryQuantity("delivery", "-5")).toBeNull();
  });

  it("returns null for zero in either mode", () => {
    expect(parseEntryQuantity("delivery", "0")).toBeNull();
    expect(parseEntryQuantity("adjustment", "0")).toBeNull();
  });

  it("returns null for a non-integer", () => {
    expect(parseEntryQuantity("adjustment", "3.7")).toBeNull();
  });
});

// The API clamps at zero (Math.max(0, before + qty)), so the preview and the
// optimistic row patch must clamp too or the table drifts from the server.
describe("resultingStock", () => {
  it("adds a positive delta", () => {
    expect(resultingStock(40, 5)).toBe(45);
  });

  it("subtracts a negative delta", () => {
    expect(resultingStock(40, -5)).toBe(35);
  });

  it("clamps at zero", () => {
    expect(resultingStock(3, -10)).toBe(0);
  });
});
