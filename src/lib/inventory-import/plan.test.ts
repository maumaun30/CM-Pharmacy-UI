import { describe, it, expect } from "vitest";
import { buildImportPlan } from "@/lib/inventory-import/plan";
import type {
  CategoryRef,
  MatchableProduct,
} from "@/lib/inventory-import/types";

const products: MatchableProduct[] = [
  {
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
    category_id: 3,
    currentStock: 40,
  },
];

const categories: CategoryRef[] = [{ id: 3, name: "Analgesic" }];

const plan = (text: string, over: Partial<Parameters<typeof buildImportPlan>[0]> = {}) =>
  buildImportPlan({
    text,
    products,
    categories,
    mode: "delivery",
    ...over,
  });

describe("classification", () => {
  it("marks a row with no differences as unchanged", () => {
    const r = plan("SKU,Name,Qty Change\nBG1,Biogesic,");
    expect(r.rows[0].status).toBe("unchanged");
    expect(r.summary.changes).toBe(0);
    expect(r.summary.unchanged).toBe(1);
  });

  it("marks a differing product field as update and names the change", () => {
    const r = plan("SKU,Name\nBG1,Biogesic Forte");
    expect(r.rows[0].status).toBe("update");
    expect(r.rows[0].changedFields).toEqual([
      { field: "Name", from: "Biogesic", to: "Biogesic Forte" },
    ]);
  });

  it("marks a matched row with only a quantity as stock-only", () => {
    const r = plan("SKU,Name,Qty Change\nBG1,Biogesic,25");
    expect(r.rows[0].status).toBe("stock-only");
    expect(r.rows[0].qtyChange).toBe(25);
  });

  it("marks an unmatched SKU as new", () => {
    const r = plan("SKU,Name,Category,Cost,Price\nNEW1,Novel,Analgesic,5,9");
    expect(r.rows[0].status).toBe("new");
  });

  it("projects the resulting stock for a matched row", () => {
    const r = plan("SKU,Qty Change\nBG1,25");
    expect(r.rows[0].currentStock).toBe(40);
    expect(r.rows[0].resultingStock).toBe(65);
  });
});

describe("column presence", () => {
  // The core safety rule: an absent header must not become an empty-string
  // update that clears the stored value.
  it("only sets fields whose header is present", () => {
    const r = plan("SKU,Qty Change\nBG1,5");
    expect(r.rows[0].fields.name).toBeUndefined();
    expect(r.rows[0].fields.barcode).toBeUndefined();
    expect(r.presentColumns).toEqual(["SKU", "Qty Change"]);
  });

  it("sets a present-but-empty cell so a value can be cleared deliberately", () => {
    const r = plan("SKU,Barcode\nBG1,");
    expect(r.rows[0].fields.barcode).toBe("");
    expect(r.rows[0].status).toBe("update");
  });
});

describe("validation", () => {
  it("errors on a negative quantity in delivery mode", () => {
    const r = plan("SKU,Qty Change\nBG1,-5");
    expect(r.rows[0].status).toBe("error");
    expect(r.rows[0].errorMessage).toContain("Adjustment mode");
  });

  it("allows a negative quantity in adjustment mode", () => {
    const r = plan("SKU,Qty Change\nBG1,-5", { mode: "adjustment" });
    expect(r.rows[0].status).toBe("stock-only");
    expect(r.rows[0].resultingStock).toBe(35);
  });

  it("errors when a new product is missing a required field", () => {
    const r = plan("SKU,Name,Qty Change\nNEW1,Novel,5");
    expect(r.rows[0].status).toBe("error");
    expect(r.rows[0].errorMessage).toContain("Category");
  });

  it("errors on an unreadable quantity rather than silently coercing it", () => {
    const r = plan("SKU,Qty Change\nBG1,abc");
    expect(r.rows[0].status).toBe("error");
    expect(r.rows[0].qtyChange).toBe(0);
  });

  // parseInt would read this as 5 and move real stock.
  it("errors on a partially numeric quantity", () => {
    const r = plan("SKU,Qty Change\nBG1,5abc");
    expect(r.rows[0].status).toBe("error");
    expect(r.rows[0].errorMessage).toContain("Qty Change");
  });

  it("errors on a fractional quantity rather than truncating it", () => {
    const r = plan("SKU,Qty Change\nBG1,3.7");
    expect(r.rows[0].status).toBe("error");
  });

  it("errors when the file has no SKU, Barcode or Name column", () => {
    const r = plan("Qty Change\n5");
    expect(r.rows[0].status).toBe("error");
  });
});

// Blank means "do this deliberately"; junk means "the user made a mistake".
// Collapsing the two silently drops edits, and for dates actively destroys
// stored data by reading as "clear this field".
describe("blank vs unreadable cells", () => {
  it("errors on an unreadable expiry date instead of clearing it", () => {
    const r = plan("SKU,Expiry Date\nBG1,asdf");
    expect(r.rows[0].status).toBe("error");
    expect(r.rows[0].errorMessage).toContain("Expiry Date");
    expect(r.rows[0].fields.expiryDate).toBeUndefined();
  });

  it("treats a blank expiry cell as a deliberate clear", () => {
    const r = plan("SKU,Expiry Date\nBG1,");
    expect(r.rows[0].fields.expiryDate).toBeNull();
    expect(r.rows[0].status).not.toBe("error");
  });

  it("errors on an unreadable cost instead of ignoring it", () => {
    const r = plan("SKU,Cost\nBG1,abc");
    expect(r.rows[0].status).toBe("error");
    expect(r.rows[0].errorMessage).toContain("Cost");
  });

  it("errors on an unreadable price", () => {
    const r = plan("SKU,Price\nBG1,1.2.3");
    expect(r.rows[0].status).toBe("error");
  });

  it("treats a blank cost cell as saying nothing", () => {
    const r = plan("SKU,Cost\nBG1,");
    expect(r.rows[0].fields.cost).toBeUndefined();
    expect(r.rows[0].status).toBe("unchanged");
  });

  it("reports every unreadable cell on the row at once", () => {
    const r = plan("SKU,Cost,Expiry Date\nBG1,abc,nope");
    expect(r.rows[0].errorMessage).toContain("Cost");
    expect(r.rows[0].errorMessage).toContain("Expiry Date");
  });
});

describe("pricing follows column presence", () => {
  it("counts a price-only difference as an update", () => {
    const r = plan("SKU,Price\nBG1,99");
    expect(r.rows[0].status).toBe("update");
  });

  it("says nothing about pricing when the column is absent", () => {
    const r = plan("SKU,Name\nBG1,Biogesic");
    expect(r.rows[0].status).toBe("unchanged");
  });
});

// A blank Status cell must not coerce to ACTIVE — that silently puts a
// discontinued product back on sale.
describe("status", () => {
  it("says nothing when the Status cell is blank", () => {
    const r = plan("SKU,Status\nBG1,");
    expect(r.rows[0].fields.status).toBeUndefined();
    expect(r.rows[0].status).toBe("unchanged");
  });

  it("reads Status case-insensitively", () => {
    const r = plan("SKU,Status\nBG1,inactive");
    expect(r.rows[0].fields.status).toBe("INACTIVE");
    expect(r.rows[0].status).toBe("update");
  });

  it("accepts an explicit ACTIVE without reporting a change", () => {
    const r = plan("SKU,Status\nBG1,ACTIVE");
    expect(r.rows[0].fields.status).toBe("ACTIVE");
    expect(r.rows[0].status).toBe("unchanged");
  });

  it("errors on a Status value that is neither ACTIVE nor INACTIVE", () => {
    const r = plan("SKU,Status\nBG1,disabled");
    expect(r.rows[0].status).toBe("error");
    expect(r.rows[0].errorMessage).toContain("Status");
  });
});

describe("boolean cells", () => {
  it("errors on an unreadable Requires Prescription cell instead of silently dropping it", () => {
    const r = plan("SKU,Requires Prescription\nBG1,Y");
    expect(r.rows[0].status).toBe("error");
    expect(r.rows[0].errorMessage).toContain("Requires Prescription");
  });

  it("treats a blank Requires Prescription cell as saying nothing", () => {
    const r = plan("SKU,Requires Prescription\nBG1,");
    expect(r.rows[0].fields.requiresPrescription).toBeUndefined();
    expect(r.rows[0].status).not.toBe("error");
  });

  it("parses Track Inventory No as false and reports it as a change", () => {
    const r = plan("SKU,Track Inventory\nBG1,No");
    expect(r.rows[0].fields.trackInventory).toBe(false);
    expect(r.rows[0].status).toBe("update");
  });
});

describe("aliases and summary", () => {
  it("reads Total Stock as Qty Change", () => {
    const r = plan("SKU,Total Stock\nBG1,7");
    expect(r.rows[0].qtyChange).toBe(7);
  });

  it("counts rows read, changes, unchanged and errors", () => {
    const r = plan(
      "SKU,Name,Qty Change\nBG1,Biogesic,\nBG1,Biogesic,5\nNEW1,Novel,1",
    );
    expect(r.summary.rowsRead).toBe(3);
    expect(r.summary.unchanged).toBe(1);
    expect(r.summary.changes).toBe(1);
    expect(r.summary.errors).toBe(1);
  });
});
