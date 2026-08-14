import { describe, it, expect } from "vitest";
import { skuPrefix, generateSku } from "@/lib/sku";

describe("skuPrefix", () => {
  it("takes the first three letters, uppercased", () => {
    expect(skuPrefix("Medicines")).toBe("MED");
  });

  it("ignores non-letters when building the prefix", () => {
    expect(skuPrefix("Over-the-counter")).toBe("OVE");
    expect(skuPrefix("Vitamins & Supplements")).toBe("VIT");
    expect(skuPrefix("  first aid")).toBe("FIR");
  });

  it("pads short names so every prefix is three characters", () => {
    expect(skuPrefix("Rx")).toBe("RXX");
  });

  it("falls back to GEN when there is nothing to work with", () => {
    expect(skuPrefix("")).toBe("GEN");
    expect(skuPrefix(null)).toBe("GEN");
    expect(skuPrefix("123 / ---")).toBe("GEN");
  });
});

describe("generateSku", () => {
  it("starts a new prefix at 0001", () => {
    expect(generateSku("Medicines", [])).toBe("MED-0001");
  });

  it("continues from the highest existing number for that prefix", () => {
    expect(generateSku("Medicines", ["MED-0001", "MED-0007", "MED-0003"])).toBe(
      "MED-0008",
    );
  });

  it("counts only SKUs sharing the prefix", () => {
    expect(generateSku("Vitamins", ["MED-0099", "VIT-0002"])).toBe("VIT-0003");
  });

  it("ignores free-form SKUs that do not follow the format", () => {
    expect(generateSku("Medicines", ["BIOGESIC", "MED001", "MED-0004"])).toBe(
      "MED-0005",
    );
  });

  it("matches existing SKUs case-insensitively", () => {
    expect(generateSku("Medicines", ["med-0012"])).toBe("MED-0013");
  });

  // A manually typed SKU can sit above the run (e.g. someone typed MED-0009
  // while the sequence was still at 0002) — skip past anything already taken.
  it("skips numbers that are already taken", () => {
    expect(generateSku("Medicines", ["MED-0001", " MED-0002 "])).toBe(
      "MED-0003",
    );
  });

  it("tolerates blank entries in the existing list", () => {
    expect(generateSku("Medicines", ["", "MED-0002"])).toBe("MED-0003");
  });
});
