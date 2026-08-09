# Unified Inventory CSV Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three separate CSV export/import flows in the web UI with a single one on the products page that can create products, update product fields, and move branch stock in one pass.

**Architecture:** All parsing, matching, diffing, and payload construction move into pure TypeScript modules under `src/lib/inventory-import/`, unit-tested with Vitest. React components consume those modules and hold only UI state. The products page gains one export button and one import dialog; `stock/add` and `stock/adjust` lose their CSV code but keep their manual single-product forms.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, shadcn/ui + Radix, Tailwind v4, dayjs, sonner, axios (`@/lib/api`), `@tanstack/react-virtual` (already a dependency), Vitest (added by Task 1).

**Spec:** `docs/superpowers/specs/2026-08-09-unified-inventory-import-design.md`. Read it before starting. Where this plan and the spec disagree, the spec wins — stop and flag it.

## Global Constraints

- **Project:** `CM-Pharmacy-UI` only. Do not modify `CM-Pharmacy-API`, `CM-Pharmacy-Mobile`, or `CM-Pharmacy-Admin`. No DB migration.
- **API request bodies are camelCase; API responses are snake_case.** This trips people up constantly. `PUT /products/:id` takes `brandName`, `categoryId`, `expiryDate`; the response has `brand_name`, `category_id`, `expiry_date`.
- **Omitting a key from a product PUT preserves the stored value.** The server falls back with `!== undefined` (`CM-Pharmacy-API/controllers/productController.js:266-269`). Sending `""` does **not** preserve — it clears. Never send `""` for a column absent from the CSV.
- **Currency is Philippine peso (`₱`).**
- **No `console.log` left in committed code.** Use `toast` from `sonner` for user-facing messages.
- **Canonical column names, exact strings:** `SKU`, `Name`, `Category`, `Barcode`, `Cost`, `Price`, `Expiry Date`, `Requires Prescription`, `Track Inventory`, `Status`, `Current Stock`, `Qty Change`, `Batch No`.
- **Accepted aliases for `Qty Change` on import:** `Total Stock`, `Adjustment`. `Qty Change` wins if more than one is present.
- **Booleans in CSV are the exact strings `Yes` / `No`. Status is `ACTIVE` / `INACTIVE`.**
- **Batch size for HTTP calls is 20**, via `Promise.allSettled`, matching the existing stock pages.
- **Commit after every task.** Conventional-commit prefixes (`feat:`, `refactor:`, `test:`, `chore:`).

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Vitest config with the `@` → `./src` path alias |
| `src/lib/csv.ts` | Generic CSV primitives: line parsing, date coercion, serialization, browser download |
| `src/lib/csv.test.ts` | Unit tests for the above |
| `src/lib/inventory-import/types.ts` | Shared types. No logic. |
| `src/lib/inventory-import/columns.ts` | Canonical column names, alias resolution, present-column detection |
| `src/lib/inventory-import/columns.test.ts` | Tests |
| `src/lib/inventory-import/normalize.ts` | Per-field normalization and equality (spec §3.1) |
| `src/lib/inventory-import/normalize.test.ts` | Tests |
| `src/lib/inventory-import/match.ts` | SKU > Barcode > Name product matcher |
| `src/lib/inventory-import/match.test.ts` | Tests |
| `src/lib/inventory-import/plan.ts` | `buildImportPlan` — text + products + mode → classified rows |
| `src/lib/inventory-import/plan.test.ts` | Tests |
| `src/lib/inventory-import/execute.ts` | `executeImportPlan` — two-phase batched HTTP apply |
| `src/lib/inventory-import/execute.test.ts` | Tests with a fake api client |
| `src/lib/inventory-import/export.ts` | Builds the export CSV from products |
| `src/lib/inventory-import/export.test.ts` | Tests |
| `src/components/inventory-import/InventoryImportDialog.tsx` | Mode / branch / reason / pricing controls, orchestration |
| `src/components/inventory-import/ImportPreviewTable.tsx` | Virtualized preview table |

**Modified:**

| File | Change |
|---|---|
| `package.json` | Vitest devDeps + `test` scripts |
| `src/app/products/page.tsx` | Replace CSV handlers with the new dialog; hide four fields |
| `src/app/stock/add/page.tsx` | Delete all CSV code, keep the manual form |
| `src/app/stock/adjust/page.tsx` | Delete all CSV code, keep the manual form |

**Why split this way:** `products/page.tsx` is already 2780 lines and the unified import is larger than the three flows it replaces. Keeping the logic in pure modules means the risky part (spec §3.1 diffing) is unit-tested without rendering React, and the dialog stays small enough to read in one screen.

---

### Task 1: Vitest harness and generic CSV primitives

The project has no test framework. The diff logic in later tasks is where this feature silently fails, so it needs real tests. This task installs Vitest and extracts the CSV primitives currently triplicated across the three pages.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/csv.ts`
- Test: `src/lib/csv.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseCSVLine(line: string): string[]`
  - `parseCSVFile(text: string): { headers: string[]; rows: string[][] }`
  - `parseCSVDate(raw: string): string | null`
  - `toCSV(rows: Record<string, string | number>[]): string`
  - `downloadCSV(filename: string, csv: string): void`

- [ ] **Step 1: Install Vitest**

```bash
cd "C:/Web Projects/CM Pharmacy/CM-Pharmacy-UI"
npm install --save-dev vitest@^2 vite-tsconfig-paths@^5
```

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block, after `"lint": "next lint"`, add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write the failing tests**

Create `src/lib/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseCSVLine, parseCSVFile, parseCSVDate, toCSV } from "@/lib/csv";

describe("parseCSVLine", () => {
  it("splits plain fields and trims them", () => {
    expect(parseCSVLine("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps commas that are inside quotes", () => {
    expect(parseCSVLine('"Ibuprofen, 200mg",IBU1')).toEqual([
      "Ibuprofen, 200mg",
      "IBU1",
    ]);
  });

  // Regression: products/page.tsx used to strip quotes a second time after
  // this function had already unescaped them, mangling names like 5" Syringe.
  it("unescapes RFC4180 doubled quotes exactly once", () => {
    expect(parseCSVLine('"5"" Syringe",SYR5')).toEqual(['5" Syringe', "SYR5"]);
  });

  it("returns an empty trailing field", () => {
    expect(parseCSVLine("a,b,")).toEqual(["a", "b", ""]);
  });
});

describe("parseCSVFile", () => {
  it("separates headers from rows and drops blank lines", () => {
    const result = parseCSVFile("SKU,Name\r\nA1,Biogesic\r\n\r\nA2,Neozep\n");
    expect(result.headers).toEqual(["SKU", "Name"]);
    expect(result.rows).toEqual([
      ["A1", "Biogesic"],
      ["A2", "Neozep"],
    ]);
  });

  it("returns empty headers and rows for empty input", () => {
    expect(parseCSVFile("")).toEqual({ headers: [], rows: [] });
  });
});

describe("parseCSVDate", () => {
  it("passes through YYYY-MM-DD", () => {
    expect(parseCSVDate("2027-01-31")).toBe("2027-01-31");
  });

  it("accepts what Excel writes", () => {
    expect(parseCSVDate("1/31/2027")).toBe("2027-01-31");
  });

  it("returns null for blank or junk rather than throwing", () => {
    expect(parseCSVDate("")).toBeNull();
    expect(parseCSVDate("not a date")).toBeNull();
  });
});

describe("toCSV", () => {
  it("writes a header row derived from the first object", () => {
    expect(toCSV([{ SKU: "A1", Qty: 5 }])).toBe('"SKU","Qty"\n"A1","5"');
  });

  it("escapes embedded quotes so the output round-trips", () => {
    const csv = toCSV([{ Name: '5" Syringe' }]);
    const parsed = parseCSVFile(csv);
    expect(parsed.rows[0]).toEqual(['5" Syringe']);
  });

  it("returns an empty string for no rows", () => {
    expect(toCSV([])).toBe("");
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "@/lib/csv"`.

- [ ] **Step 6: Write the implementation**

Create `src/lib/csv.ts`:

```ts
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

// RFC4180 line splitter. Callers must NOT strip quotes again afterwards —
// doubled quotes are already unescaped here, and a second pass mangles names
// that legitimately contain a quote (e.g. 5" Syringe).
export const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCSVFile = (
  text: string,
): { headers: string[]; rows: string[][] } => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  return {
    headers: parseCSVLine(lines[0]).map((h) => h.trim()),
    rows: lines.slice(1).map(parseCSVLine),
  };
};

// Expiry cells are hand-typed. Accept YYYY-MM-DD (what the export writes) and
// the M/D/YYYY that Excel produces; fall back to null. A junk date must never
// block the rest of the row from importing.
export const parseCSVDate = (raw: string): string | null => {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const explicit = dayjs(trimmed, ["YYYY-MM-DD", "M/D/YYYY", "D/M/YYYY"], true);
  if (explicit.isValid()) return explicit.format("YYYY-MM-DD");
  const loose = dayjs(trimmed);
  return loose.isValid() ? loose.format("YYYY-MM-DD") : null;
};

export const toCSV = (rows: Record<string, string | number>[]): string => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
};

export const downloadCSV = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 12 tests.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/csv.ts src/lib/csv.test.ts
git commit -m "test: add vitest and extract shared CSV primitives

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Types and column resolution

**Files:**
- Create: `src/lib/inventory-import/types.ts`
- Create: `src/lib/inventory-import/columns.ts`
- Test: `src/lib/inventory-import/columns.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the types below, plus `resolveColumns(headers: string[]): ResolvedColumns` and `QTY_CHANGE_ALIASES`.

- [ ] **Step 1: Create `src/lib/inventory-import/types.ts`**

No tests — declarations only.

```ts
export type ImportMode = "delivery" | "adjustment";

export type CanonicalColumn =
  | "SKU"
  | "Name"
  | "Category"
  | "Barcode"
  | "Cost"
  | "Price"
  | "Expiry Date"
  | "Requires Prescription"
  | "Track Inventory"
  | "Status"
  | "Qty Change"
  | "Batch No";

// The subset of a product the import logic needs. Deliberately narrower than
// the products page's Product interface so this module stays independent of it.
export interface MatchableProduct {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  cost: number;
  price: number;
  expiry_date?: string | null;
  requires_prescription: boolean;
  track_inventory: boolean;
  status: "ACTIVE" | "INACTIVE";
  category_id: number;
  currentStock: number;
}

export interface CategoryRef {
  id: number;
  name: string;
}

// Only keys whose header was present in the CSV are set. An absent key means
// "do not send", which is how the server is told to preserve the stored value.
export interface CsvProductFields {
  name?: string;
  sku?: string;
  categoryName?: string;
  barcode?: string;
  cost?: number;
  price?: number;
  expiryDate?: string | null;
  requiresPrescription?: boolean;
  trackInventory?: boolean;
  status?: "ACTIVE" | "INACTIVE";
}

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export type PlanRowStatus =
  | "new"
  | "update"
  | "stock-only"
  | "unchanged"
  | "error";

export interface PlanRow {
  lineNumber: number;
  sku: string;
  name: string;
  status: PlanRowStatus;
  errorMessage?: string;
  matchedProduct: MatchableProduct | null;
  matchedBy: "sku" | "barcode" | "name" | null;
  fields: CsvProductFields;
  changedFields: FieldChange[];
  qtyChange: number;
  batchNumber: string;
  currentStock: number | null;
  resultingStock: number | null;
}

export interface ImportSummary {
  rowsRead: number;
  changes: number;
  unchanged: number;
  errors: number;
}

export interface ImportPlan {
  rows: PlanRow[];
  presentColumns: CanonicalColumn[];
  // Headers in the file that this import does not act on. Surfaced in the
  // dialog so an old-format CSV explains itself instead of silently doing
  // nothing. See ResolvedColumns for the ignored/unknown distinction.
  ignoredColumns: string[];
  unknownColumns: string[];
  summary: ImportSummary;
}

export interface ImportResult {
  created: number;
  updated: number;
  stocked: number;
  skipped: number;
  failed: number;
  firstError: string;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/inventory-import/columns.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- columns`
Expected: FAIL — cannot resolve `@/lib/inventory-import/columns`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/inventory-import/columns.ts`:

```ts
import type { CanonicalColumn } from "./types";

export const CANONICAL_COLUMNS: CanonicalColumn[] = [
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
  "Qty Change",
  "Batch No",
];

// Files exported by the old stock/add and stock/adjust pages used these names
// for what is now a single column. Accepted so held files keep working.
export const QTY_CHANGE_ALIASES = ["Total Stock", "Adjustment"];

// Written by the export as read-only reference; the import ignores it. Listed
// so it is not reported as an unknown header.
const IGNORED_COLUMNS = ["Current Stock", "ID"];

export interface ResolvedColumns {
  indexOf: Partial<Record<CanonicalColumn, number>>;
  present: CanonicalColumn[];
  unknown: string[];
}

const norm = (h: string) => h.trim().toLowerCase();

export const resolveColumns = (headers: string[]): ResolvedColumns => {
  const indexOf: Partial<Record<CanonicalColumn, number>> = {};
  const claimed = new Set<number>();

  for (const col of CANONICAL_COLUMNS) {
    const idx = headers.findIndex((h) => norm(h) === norm(col));
    if (idx >= 0) {
      indexOf[col] = idx;
      claimed.add(idx);
    }
  }

  // Aliases only fill in when the canonical header is absent.
  if (indexOf["Qty Change"] === undefined) {
    for (const alias of QTY_CHANGE_ALIASES) {
      const idx = headers.findIndex((h) => norm(h) === norm(alias));
      if (idx >= 0) {
        indexOf["Qty Change"] = idx;
        claimed.add(idx);
        break;
      }
    }
  }

  const unknown = headers.filter(
    (h, i) =>
      !claimed.has(i) && !IGNORED_COLUMNS.some((c) => norm(c) === norm(h)),
  );

  return {
    indexOf,
    present: CANONICAL_COLUMNS.filter((c) => indexOf[c] !== undefined),
    unknown,
  };
};
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- columns`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/inventory-import/
git commit -m "feat: add inventory import types and column resolution

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Field normalization and equality

This is the highest-risk module in the feature. If comparison is too loose, every row reports as changed and the changes-only preview does nothing. If it is too tight, real edits are classified unchanged and silently never sent.

**Files:**
- Create: `src/lib/inventory-import/normalize.ts`
- Test: `src/lib/inventory-import/normalize.test.ts`

**Interfaces:**
- Consumes: `CsvProductFields`, `MatchableProduct`, `CategoryRef`, `FieldChange` from Task 2.
- Produces: `diffProductFields(fields, product, categories, options): FieldChange[]`, plus `parseBoolCell`, `parseNumberCell`, `formatMoney`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/inventory-import/normalize.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- normalize`
Expected: FAIL — cannot resolve `@/lib/inventory-import/normalize`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/inventory-import/normalize.ts`:

```ts
import dayjs from "dayjs";
import type {
  CategoryRef,
  CsvProductFields,
  FieldChange,
  MatchableProduct,
} from "./types";

export const parseBoolCell = (raw: string): boolean | undefined => {
  const v = raw?.trim().toLowerCase();
  if (v === "yes" || v === "true" || v === "1") return true;
  if (v === "no" || v === "false" || v === "0") return false;
  return undefined;
};

export const parseNumberCell = (raw: string): number | undefined => {
  const v = raw?.trim().replace(/,/g, "");
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const formatMoney = (n: number | null | undefined): string =>
  n == null ? "" : Number(n).toFixed(2);

const text = (v: string | null | undefined): string => (v ?? "").trim();

const day = (v: string | null | undefined): string => {
  const t = text(v);
  if (!t) return "";
  const d = dayjs(t);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
};

// Mirrors the export's `=== false ? "No" : "Yes"`. Both treat undefined as
// tracked, matching the DB column (boolean not null default true). If the two
// disagreed, an undefined value would report every product as changed on
// every import.
const bool = (v?: boolean): string => (v === false ? "No" : "Yes");

const findCategory = (categories: CategoryRef[], name: string) =>
  categories.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());

/**
 * Compares the CSV cells present on a row against the stored product.
 *
 * Only keys present on `fields` are compared — an absent key means the column
 * was not in the CSV header, so there is nothing to say about it. A key set to
 * an empty string IS compared, because clearing a value deliberately is a real
 * edit.
 *
 * Every comparison is normalized. Raw string comparison would report every row
 * as changed (the export writes "10.00" where the API returns 10), which
 * silently disables the changes-only preview.
 */
export const diffProductFields = (
  fields: CsvProductFields,
  product: MatchableProduct,
  categories: CategoryRef[],
  options: { updatePricing: boolean },
): FieldChange[] => {
  const changes: FieldChange[] = [];
  const push = (field: string, from: string, to: string) => {
    if (from !== to) changes.push({ field, from, to });
  };

  if (fields.name !== undefined) {
    push("Name", text(product.name), text(fields.name));
  }
  if (fields.sku !== undefined) {
    push("SKU", text(product.sku), text(fields.sku));
  }
  if (fields.barcode !== undefined) {
    push("Barcode", text(product.barcode), text(fields.barcode));
  }
  if (fields.status !== undefined) {
    push("Status", product.status, fields.status);
  }
  if (fields.expiryDate !== undefined) {
    push("Expiry Date", day(product.expiry_date), day(fields.expiryDate));
  }
  if (fields.requiresPrescription !== undefined) {
    push(
      "Requires Prescription",
      bool(product.requires_prescription),
      bool(fields.requiresPrescription),
    );
  }
  if (fields.trackInventory !== undefined) {
    push(
      "Track Inventory",
      bool(product.track_inventory),
      bool(fields.trackInventory),
    );
  }
  // A blank Category cell says nothing about category — the same doctrine
  // text() applies to every other field. Without this guard it resolves to the
  // sentinel "new:" and the executor creates a category with an empty name.
  // Category is still required to CREATE a product; plan.ts enforces that
  // separately via its missing-field check.
  if (fields.categoryName !== undefined && text(fields.categoryName) !== "") {
    const stored = categories.find((c) => c.id === product.category_id);
    const incoming = findCategory(categories, fields.categoryName);
    // An unknown category name will be created on apply, so it is a change.
    const from = String(product.category_id);
    const to = incoming ? String(incoming.id) : `new:${text(fields.categoryName)}`;
    if (from !== to) {
      changes.push({
        field: "Category",
        from: stored?.name ?? "",
        to: text(fields.categoryName),
      });
    }
  }

  // Cost and Price are not sent when the pricing checkbox is off, so a
  // difference in them is not work to do and must not count as a change.
  if (options.updatePricing) {
    if (fields.cost !== undefined) {
      push("Cost", formatMoney(product.cost), formatMoney(fields.cost));
    }
    if (fields.price !== undefined) {
      push("Price", formatMoney(product.price), formatMoney(fields.price));
    }
  }

  return changes;
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- normalize`
Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory-import/normalize.ts src/lib/inventory-import/normalize.test.ts
git commit -m "feat: add normalized field diffing for inventory import

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Product matcher

**Files:**
- Create: `src/lib/inventory-import/match.ts`
- Test: `src/lib/inventory-import/match.test.ts`

**Interfaces:**
- Consumes: `MatchableProduct` from Task 2.
- Produces: `buildProductMatcher(products: MatchableProduct[]): (row: { sku: string; barcode: string; name: string }) => { product: MatchableProduct | null; matchedBy: "sku" | "barcode" | "name" | null }`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/inventory-import/match.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- match`
Expected: FAIL — cannot resolve `@/lib/inventory-import/match`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/inventory-import/match.ts`:

```ts
import type { MatchableProduct } from "./types";

export interface MatchResult {
  product: MatchableProduct | null;
  matchedBy: "sku" | "barcode" | "name" | null;
}

/**
 * Builds a SKU > Barcode > Name matcher. Blank keys never match, so a row with
 * no SKU does not collide with a product whose SKU is empty.
 *
 * First product wins on a duplicate key.
 */
export const buildProductMatcher = (products: MatchableProduct[]) => {
  const bySku = new Map<string, MatchableProduct>();
  const byBarcode = new Map<string, MatchableProduct>();
  const byName = new Map<string, MatchableProduct>();

  for (const p of products) {
    const sku = p.sku?.trim().toLowerCase();
    const barcode = p.barcode?.trim().toLowerCase();
    const name = p.name?.trim().toLowerCase();
    if (sku && !bySku.has(sku)) bySku.set(sku, p);
    if (barcode && !byBarcode.has(barcode)) byBarcode.set(barcode, p);
    if (name && !byName.has(name)) byName.set(name, p);
  }

  return (row: {
    sku: string;
    barcode: string;
    name: string;
  }): MatchResult => {
    const sku = row.sku?.trim().toLowerCase();
    if (sku && bySku.has(sku)) {
      return { product: bySku.get(sku)!, matchedBy: "sku" };
    }
    const barcode = row.barcode?.trim().toLowerCase();
    if (barcode && byBarcode.has(barcode)) {
      return { product: byBarcode.get(barcode)!, matchedBy: "barcode" };
    }
    const name = row.name?.trim().toLowerCase();
    if (name && byName.has(name)) {
      return { product: byName.get(name)!, matchedBy: "name" };
    }
    return { product: null, matchedBy: null };
  };
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- match`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory-import/match.ts src/lib/inventory-import/match.test.ts
git commit -m "feat: add SKU/barcode/name product matcher

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Import plan builder

Turns raw CSV text into classified rows. This is the module the preview renders and the executor consumes.

**Files:**
- Create: `src/lib/inventory-import/plan.ts`
- Test: `src/lib/inventory-import/plan.test.ts`

**Interfaces:**
- Consumes: `parseCSVFile`, `parseCSVDate` (Task 1); `resolveColumns` (Task 2); `diffProductFields`, `parseBoolCell`, `parseNumberCell` (Task 3); `buildProductMatcher` (Task 4).
- Produces: `buildImportPlan(input): ImportPlan`

```ts
buildImportPlan(input: {
  text: string;
  products: MatchableProduct[];
  categories: CategoryRef[];
  mode: ImportMode;
  updatePricing: boolean;
}): ImportPlan
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/inventory-import/plan.test.ts`:

```ts
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
    updatePricing: false,
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
    const r = plan("SKU,Cost\nBG1,abc", { updatePricing: true });
    expect(r.rows[0].status).toBe("error");
    expect(r.rows[0].errorMessage).toContain("Cost");
  });

  it("errors on an unreadable price even when pricing updates are off", () => {
    // The cell is unreadable regardless of whether we would have sent it.
    const r = plan("SKU,Price\nBG1,1.2.3");
    expect(r.rows[0].status).toBe("error");
  });

  it("treats a blank cost cell as saying nothing", () => {
    const r = plan("SKU,Cost\nBG1,", { updatePricing: true });
    expect(r.rows[0].fields.cost).toBeUndefined();
    expect(r.rows[0].status).toBe("unchanged");
  });

  it("reports every unreadable cell on the row at once", () => {
    const r = plan("SKU,Cost,Expiry Date\nBG1,abc,nope", {
      updatePricing: true,
    });
    expect(r.rows[0].errorMessage).toContain("Cost");
    expect(r.rows[0].errorMessage).toContain("Expiry Date");
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

describe("pricing gate", () => {
  it("does not count a price-only difference when pricing is off", () => {
    const r = plan("SKU,Price\nBG1,99");
    expect(r.rows[0].status).toBe("unchanged");
  });

  it("counts it when pricing is on", () => {
    const r = plan("SKU,Price\nBG1,99", { updatePricing: true });
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- plan`
Expected: FAIL — cannot resolve `@/lib/inventory-import/plan`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/inventory-import/plan.ts`:

```ts
import { parseCSVDate, parseCSVFile } from "@/lib/csv";
import { resolveColumns } from "./columns";
import { buildProductMatcher } from "./match";
import {
  diffProductFields,
  parseBoolCell,
  parseNumberCell,
} from "./normalize";
import type {
  CanonicalColumn,
  CategoryRef,
  CsvProductFields,
  ImportMode,
  ImportPlan,
  MatchableProduct,
  PlanRow,
} from "./types";

export const buildImportPlan = (input: {
  text: string;
  products: MatchableProduct[];
  categories: CategoryRef[];
  mode: ImportMode;
  updatePricing: boolean;
}): ImportPlan => {
  const { text, products, categories, mode, updatePricing } = input;
  const { headers, rows } = parseCSVFile(text);
  const cols = resolveColumns(headers);
  const match = buildProductMatcher(products);

  const at = (row: string[], col: CanonicalColumn): string | undefined => {
    const idx = cols.indexOf[col];
    if (idx === undefined) return undefined;
    return row[idx] ?? "";
  };

  const hasIdentityColumn =
    cols.indexOf.SKU !== undefined ||
    cols.indexOf.Barcode !== undefined ||
    cols.indexOf.Name !== undefined;

  const planRows: PlanRow[] = rows.map((row, i) => {
    // Internal row identity only — used as a Map key by the executor and a
    // React key by the preview, never displayed. It counts NON-BLANK rows,
    // because parseCSVFile drops blank lines before this indexing, so it will
    // not match the user's spreadsheet row number in a file with interior
    // blank lines. Make it a true source line number before ever showing it.
    const lineNumber = i + 2; // 1-based, +1 for the header line
    const sku = at(row, "SKU") ?? "";
    const name = at(row, "Name") ?? "";
    const barcode = at(row, "Barcode") ?? "";

    const base: PlanRow = {
      lineNumber,
      sku,
      name,
      status: "unchanged",
      matchedProduct: null,
      matchedBy: null,
      fields: {},
      changedFields: [],
      qtyChange: 0,
      batchNumber: at(row, "Batch No") ?? "",
      currentStock: null,
      resultingStock: null,
    };

    if (!hasIdentityColumn) {
      return {
        ...base,
        status: "error",
        errorMessage: "File needs a SKU, Barcode or Name column",
      };
    }

    // Only headers that exist become keys. An absent key is never sent, which
    // is how the server is told to preserve the stored value.
    const fields: CsvProductFields = {};
    if (cols.indexOf.Name !== undefined) fields.name = name;
    if (cols.indexOf.SKU !== undefined) fields.sku = sku;
    if (cols.indexOf.Barcode !== undefined) fields.barcode = barcode;
    if (cols.indexOf.Category !== undefined)
      fields.categoryName = at(row, "Category") ?? "";
    // Blank and junk are different instructions and must not collapse. A
    // blank cell is deliberate ("clear this", "no quantity"); a cell holding
    // content that will not parse is a user mistake. Silently dropping the
    // latter is bad for numbers and destructive for dates — an unreadable
    // expiry cell would otherwise read as "clear the expiry" and wipe a real
    // stored date on apply.
    const cellErrors: string[] = [];

    const numberCell = (col: CanonicalColumn): number | undefined => {
      const raw = at(row, col);
      if (raw === undefined) return undefined; // column absent
      if (!raw.trim()) return undefined; // blank cell: say nothing
      const n = parseNumberCell(raw);
      if (n === undefined) cellErrors.push(`${col} "${raw}" is not a number`);
      return n;
    };

    if (cols.indexOf.Cost !== undefined) fields.cost = numberCell("Cost");
    if (cols.indexOf.Price !== undefined) fields.price = numberCell("Price");
    if (cols.indexOf["Expiry Date"] !== undefined) {
      const raw = at(row, "Expiry Date") ?? "";
      if (!raw.trim()) {
        fields.expiryDate = null; // blank: clear it deliberately
      } else {
        const parsed = parseCSVDate(raw);
        if (parsed === null) {
          cellErrors.push(`Expiry Date "${raw}" is not a date`);
        } else {
          fields.expiryDate = parsed;
        }
      }
    }
    if (cols.indexOf["Requires Prescription"] !== undefined)
      fields.requiresPrescription = parseBoolCell(
        at(row, "Requires Prescription") ?? "",
      );
    if (cols.indexOf["Track Inventory"] !== undefined)
      fields.trackInventory = parseBoolCell(at(row, "Track Inventory") ?? "");
    if (cols.indexOf.Status !== undefined) {
      const rawStatus = at(row, "Status") ?? "";
      const status = rawStatus.trim().toUpperCase();
      if (!status) {
        // Blank says nothing about status, exactly as for Cost and Expiry
        // Date. Coercing it to ACTIVE would silently put a discontinued
        // product back on sale.
      } else if (status === "ACTIVE" || status === "INACTIVE") {
        fields.status = status;
      } else {
        cellErrors.push(`Status "${rawStatus}" is not ACTIVE or INACTIVE`);
      }
    }

    // Blank means "no movement" — the normal state of most rows in a full
    // export. Anything else must be a clean whole number: parseInt alone
    // would read "5abc" as 5 and "3.7" as 3, turning a malformed cell into a
    // real stock movement with no warning.
    const qtyRaw = (at(row, "Qty Change") ?? "").trim();
    let qtyChange = 0;
    if (qtyRaw) {
      if (/^-?\d+$/.test(qtyRaw)) {
        qtyChange = parseInt(qtyRaw, 10);
      } else {
        cellErrors.push(`Qty Change "${qtyRaw}" is not a whole number`);
      }
    }

    const { product, matchedBy } = match({ sku, barcode, name });
    const row0: PlanRow = { ...base, fields, qtyChange, matchedBy };

    // Unreadable cells fail the row before anything else is decided.
    if (cellErrors.length > 0) {
      return { ...row0, status: "error", errorMessage: cellErrors.join("; ") };
    }

    if (mode === "delivery" && qtyChange < 0) {
      return {
        ...row0,
        status: "error",
        errorMessage:
          "Delivery quantities must be positive. Use Adjustment mode to reduce stock.",
      };
    }

    if (!product) {
      const missing: string[] = [];
      if (!sku.trim()) missing.push("SKU");
      if (!name.trim()) missing.push("Name");
      if (!fields.categoryName?.trim()) missing.push("Category");
      if (fields.cost === undefined) missing.push("Cost");
      if (fields.price === undefined) missing.push("Price");
      if (missing.length > 0) {
        return {
          ...row0,
          status: "error",
          errorMessage: `New product is missing: ${missing.join(", ")}`,
        };
      }
      return {
        ...row0,
        status: "new",
        currentStock: 0,
        resultingStock: qtyChange,
      };
    }

    const changedFields = diffProductFields(fields, product, categories, {
      updatePricing,
    });
    const currentStock = product.currentStock;
    const resultingStock = currentStock + qtyChange;

    let status: PlanRow["status"];
    if (changedFields.length > 0) status = "update";
    else if (qtyChange !== 0) status = "stock-only";
    else status = "unchanged";

    return {
      ...row0,
      status,
      matchedProduct: product,
      changedFields,
      currentStock,
      resultingStock,
    };
  });

  const summary = {
    rowsRead: planRows.length,
    changes: planRows.filter(
      (r) => r.status === "new" || r.status === "update" || r.status === "stock-only",
    ).length,
    unchanged: planRows.filter((r) => r.status === "unchanged").length,
    errors: planRows.filter((r) => r.status === "error").length,
  };

  return {
    rows: planRows,
    presentColumns: cols.present,
    ignoredColumns: cols.ignored,
    unknownColumns: cols.unknown,
    summary,
  };
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- plan`
Expected: PASS, 28 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory-import/plan.ts src/lib/inventory-import/plan.test.ts
git commit -m "feat: add inventory import plan builder

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Plan executor

Two-phase batched apply. Phase 1 resolves product ids (create or update); phase 2 moves stock. Rows whose product phase failed must be counted as failed, not silently dropped.

**Files:**
- Create: `src/lib/inventory-import/execute.ts`
- Test: `src/lib/inventory-import/execute.test.ts`

**Interfaces:**
- Consumes: `PlanRow`, `ImportMode`, `ImportResult`, `CategoryRef` from Task 2.
- Produces:

```ts
executeImportPlan(rows: PlanRow[], options: {
  client: ImportApiClient;
  mode: ImportMode;
  branchId: number;
  reason: string;
  updatePricing: boolean;
  overwriteExisting: boolean;
  categories: CategoryRef[];
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportResult>
```

with

```ts
export interface ImportApiClient {
  post: (url: string, body: unknown) => Promise<{ data: any }>;
  put: (url: string, body: unknown) => Promise<{ data: any }>;
}
```

The real `@/lib/api` axios instance satisfies `ImportApiClient` structurally, so tests inject a fake and no HTTP mocking library is needed.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/inventory-import/execute.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { executeImportPlan } from "@/lib/inventory-import/execute";
import type { PlanRow } from "@/lib/inventory-import/types";

const row = (over: Partial<PlanRow>): PlanRow => ({
  lineNumber: 2,
  sku: "BG1",
  name: "Biogesic",
  status: "unchanged",
  matchedProduct: null,
  matchedBy: null,
  fields: {},
  changedFields: [],
  qtyChange: 0,
  batchNumber: "",
  currentStock: 0,
  resultingStock: 0,
  ...over,
});

const product = {
  id: 1,
  name: "Biogesic",
  sku: "BG1",
  barcode: "4800",
  cost: 10,
  price: 15,
  expiry_date: null,
  requires_prescription: false,
  track_inventory: true,
  status: "ACTIVE" as const,
  category_id: 3,
  currentStock: 40,
};

const fakeClient = () => ({
  post: vi.fn().mockResolvedValue({ data: { id: 99 } }),
  put: vi.fn().mockResolvedValue({ data: {} }),
});

const run = (rows: PlanRow[], client: ReturnType<typeof fakeClient>, over = {}) =>
  executeImportPlan(rows, {
    client,
    mode: "delivery",
    branchId: 7,
    reason: "",
    updatePricing: false,
    overwriteExisting: true,
    categories: [{ id: 3, name: "Analgesic" }],
    ...over,
  });

it("sends nothing at all for unchanged rows", async () => {
  const client = fakeClient();
  const result = await run([row({ status: "unchanged" })], client);
  expect(client.post).not.toHaveBeenCalled();
  expect(client.put).not.toHaveBeenCalled();
  expect(result).toMatchObject({ created: 0, updated: 0, stocked: 0 });
});

it("sends nothing for error rows", async () => {
  const client = fakeClient();
  await run([row({ status: "error", errorMessage: "bad" })], client);
  expect(client.post).not.toHaveBeenCalled();
  expect(client.put).not.toHaveBeenCalled();
});

it("puts only the fields present on the row", async () => {
  const client = fakeClient();
  await run(
    [
      row({
        status: "update",
        matchedProduct: product,
        fields: { name: "Biogesic Forte" },
        changedFields: [{ field: "Name", from: "Biogesic", to: "Biogesic Forte" }],
      }),
    ],
    client,
  );
  expect(client.put).toHaveBeenCalledWith("/products/1", { name: "Biogesic Forte" });
});

it("omits cost and price when pricing is off", async () => {
  const client = fakeClient();
  await run(
    [
      row({
        status: "update",
        matchedProduct: product,
        fields: { name: "X", cost: 99, price: 99 },
        changedFields: [{ field: "Name", from: "Biogesic", to: "X" }],
      }),
    ],
    client,
  );
  const body = client.put.mock.calls[0][1] as Record<string, unknown>;
  expect(body).not.toHaveProperty("cost");
  expect(body).not.toHaveProperty("price");
});

it("skips matched rows when overwriteExisting is false", async () => {
  const client = fakeClient();
  const result = await run(
    [
      row({
        status: "update",
        matchedProduct: product,
        fields: { name: "X" },
        changedFields: [{ field: "Name", from: "Biogesic", to: "X" }],
      }),
    ],
    client,
    { overwriteExisting: false },
  );
  expect(client.put).not.toHaveBeenCalled();
  expect(result.skipped).toBe(1);
});

it("posts a delivery to /stock/add with the target branch", async () => {
  const client = fakeClient();
  await run(
    [row({ status: "stock-only", matchedProduct: product, qtyChange: 25, batchNumber: "B-9" })],
    client,
  );
  expect(client.post).toHaveBeenCalledWith("/stock/add", {
    productId: 1,
    branchId: 7,
    quantity: 25,
    batchNumber: "B-9",
    expiryDate: null,
    unitCost: null,
    sellingPrice: null,
    supplier: null,
    transactionType: "PURCHASE",
  });
});

it("posts an adjustment to /stock/adjust with the reason", async () => {
  const client = fakeClient();
  await run(
    [row({ status: "stock-only", matchedProduct: product, qtyChange: -3 })],
    client,
    { mode: "adjustment", reason: "expired" },
  );
  expect(client.post).toHaveBeenCalledWith("/stock/adjust", {
    productId: 1,
    branchId: 7,
    quantity: -3,
    reason: "expired",
    unitCost: null,
    sellingPrice: null,
  });
});

it("creates a product then stocks the new id", async () => {
  const client = fakeClient();
  client.post.mockImplementation(async (url: string) =>
    url === "/products" ? { data: { id: 55 } } : { data: {} },
  );
  const result = await run(
    [
      row({
        status: "new",
        fields: {
          name: "Novel",
          sku: "NEW1",
          categoryName: "Analgesic",
          cost: 5,
          price: 9,
        },
        qtyChange: 12,
      }),
    ],
    client,
  );
  expect(client.post).toHaveBeenCalledWith(
    "/products",
    expect.objectContaining({ sku: "NEW1", categoryId: 3 }),
  );
  expect(client.post).toHaveBeenCalledWith(
    "/stock/add",
    expect.objectContaining({ productId: 55, quantity: 12 }),
  );
  expect(result).toMatchObject({ created: 1, stocked: 1 });
});

it("creates an unknown category once and reuses it", async () => {
  const client = fakeClient();
  client.post.mockImplementation(async (url: string) => {
    if (url === "/categories") return { data: { id: 77, name: "Vitamins" } };
    if (url === "/products") return { data: { id: 56 } };
    return { data: {} };
  });
  const newRow = (sku: string) =>
    row({
      status: "new",
      sku,
      fields: { name: sku, sku, categoryName: "Vitamins", cost: 1, price: 2 },
    });
  await run([newRow("V1"), newRow("V2")], client);
  const categoryCalls = client.post.mock.calls.filter((c) => c[0] === "/categories");
  expect(categoryCalls).toHaveLength(1);
});

// A row whose product phase failed must not silently vanish from the totals.
it("counts a failed product upsert and skips its stock call", async () => {
  const client = fakeClient();
  client.put.mockRejectedValue({
    response: { data: { message: "SKU already exists" } },
  });
  const result = await run(
    [
      row({
        status: "update",
        matchedProduct: product,
        fields: { name: "X" },
        changedFields: [{ field: "Name", from: "Biogesic", to: "X" }],
        qtyChange: 5,
      }),
    ],
    client,
  );
  expect(result.failed).toBe(1);
  expect(result.stocked).toBe(0);
  expect(result.firstError).toBe("SKU already exists");
  expect(client.post).not.toHaveBeenCalled();
});

it("reports progress as it works", async () => {
  const client = fakeClient();
  const onProgress = vi.fn();
  await run(
    [row({ status: "stock-only", matchedProduct: product, qtyChange: 1 })],
    client,
    { onProgress },
  );
  expect(onProgress).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- execute`
Expected: FAIL — cannot resolve `@/lib/inventory-import/execute`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/inventory-import/execute.ts`:

```ts
import type {
  CategoryRef,
  ImportMode,
  ImportResult,
  PlanRow,
} from "./types";

export interface ImportApiClient {
  post: (url: string, body: unknown) => Promise<{ data: any }>;
  put: (url: string, body: unknown) => Promise<{ data: any }>;
}

export interface ExecuteOptions {
  client: ImportApiClient;
  mode: ImportMode;
  branchId: number;
  reason: string;
  updatePricing: boolean;
  overwriteExisting: boolean;
  categories: CategoryRef[];
  onProgress?: (done: number, total: number) => void;
}

const BATCH_SIZE = 20;

const errorMessage = (e: unknown): string => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || "Unknown server error";
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Applies a plan in two phases.
 *
 * Phase 1 resolves a product id for every actionable row — creating or updating
 * as needed. Phase 2 moves stock for rows that have both a resolved id and a
 * non-zero quantity. The split exists because a newly created product has no id
 * until its POST returns.
 *
 * Rows with status "unchanged" or "error" produce no requests at all.
 */
export const executeImportPlan = async (
  rows: PlanRow[],
  options: ExecuteOptions,
): Promise<ImportResult> => {
  const {
    client,
    mode,
    branchId,
    reason,
    updatePricing,
    overwriteExisting,
    onProgress,
  } = options;

  const result: ImportResult = {
    created: 0,
    updated: 0,
    stocked: 0,
    skipped: 0,
    failed: 0,
    firstError: "",
  };

  const fail = (e: unknown) => {
    result.failed++;
    if (!result.firstError) result.firstError = errorMessage(e);
  };

  const actionable = rows.filter(
    (r) => r.status === "new" || r.status === "update" || r.status === "stock-only",
  );

  // Categories are resolved serially before the batches so two rows naming the
  // same new category cannot race and create it twice.
  const categories = [...options.categories];
  const categoryId = async (name: string): Promise<number> => {
    const found = categories.find(
      (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (found) return found.id;
    const res = await client.post("/categories", { name });
    categories.push(res.data);
    return res.data.id as number;
  };

  // Every actionable row ticks once in phase 1; rows with a quantity tick
  // again in phase 2. Both counts are known upfront, so the indicator can
  // actually reach its total instead of stalling short.
  const total =
    actionable.length + actionable.filter((r) => r.qtyChange !== 0).length;
  let done = 0;
  const tick = () => {
    done++;
    onProgress?.(done, total);
  };

  // Pre-resolve every category serially, for EVERY actionable row that names
  // one — not just new products. Update rows resolve categories too, and doing
  // that inside the parallel batches lets two rows naming the same new category
  // race and create it twice.
  for (const row of actionable) {
    if (row.fields.categoryName) {
      try {
        await categoryId(row.fields.categoryName);
      } catch {
        // Leave it — each row's own attempt in phase 1 fails and is counted there.
      }
    }
  }

  // ── Phase 1: resolve a product id per row ──────────────────────────────
  const resolved = new Map<number, number>(); // lineNumber -> productId

  for (const batch of chunk(actionable, BATCH_SIZE)) {
    const settled = await Promise.allSettled(
      batch.map(async (row) => {
        if (row.status === "stock-only") {
          return { row, productId: row.matchedProduct!.id, kind: "none" as const };
        }

        if (row.status === "update") {
          if (!overwriteExisting) {
            // The checkbox governs product master data only. Keep the resolved
            // id so phase 2 still applies this row's stock movement — someone
            // who declines to overwrite the sheet's prices still expects the
            // delivery to arrive.
            return {
              row,
              productId: row.matchedProduct!.id,
              kind: "skipped" as const,
            };
          }
          const body: Record<string, unknown> = {};
          const f = row.fields;
          if (f.name !== undefined) body.name = f.name;
          if (f.sku !== undefined) body.sku = f.sku;
          if (f.barcode !== undefined) body.barcode = f.barcode || null;
          if (f.expiryDate !== undefined && mode === "adjustment")
            body.expiryDate = f.expiryDate;
          if (f.requiresPrescription !== undefined)
            body.requiresPrescription = f.requiresPrescription;
          if (f.trackInventory !== undefined) body.trackInventory = f.trackInventory;
          if (f.status !== undefined) body.status = f.status;
          if (f.categoryName !== undefined)
            body.categoryId = await categoryId(f.categoryName);
          if (updatePricing) {
            if (f.cost !== undefined) body.cost = f.cost;
            if (f.price !== undefined) body.price = f.price;
          }
          await client.put(`/products/${row.matchedProduct!.id}`, body);
          return { row, productId: row.matchedProduct!.id, kind: "updated" as const };
        }

        // status === "new"
        const f = row.fields;
        const body: Record<string, unknown> = {
          name: f.name,
          sku: f.sku,
          barcode: f.barcode || null,
          cost: f.cost,
          price: f.price,
          categoryId: await categoryId(f.categoryName!),
          requiresPrescription: f.requiresPrescription ?? false,
          trackInventory: f.trackInventory ?? true,
          status: f.status ?? "ACTIVE",
        };
        // In delivery mode /stock/add writes the expiry onto the product, so
        // sending it here too would be a redundant second write.
        if (f.expiryDate !== undefined && mode === "adjustment")
          body.expiryDate = f.expiryDate;
        const res = await client.post("/products", body);
        return { row, productId: res.data.id as number, kind: "created" as const };
      }),
    );

    for (const s of settled) {
      if (s.status === "rejected") {
        fail(s.reason);
        tick();
        continue;
      }
      const { row, productId, kind } = s.value;
      if (kind === "created") result.created++;
      if (kind === "updated") result.updated++;
      if (kind === "skipped") result.skipped++;
      if (productId != null) resolved.set(row.lineNumber, productId);
      tick();
    }
  }

  // ── Phase 2: move stock ────────────────────────────────────────────────
  const stockRows = actionable.filter(
    (r) => r.qtyChange !== 0 && resolved.has(r.lineNumber),
  );

  for (const batch of chunk(stockRows, BATCH_SIZE)) {
    const settled = await Promise.allSettled(
      batch.map((row) => {
        const productId = resolved.get(row.lineNumber)!;
        const unitCost = updatePricing && row.fields.cost != null ? row.fields.cost : null;
        const sellingPrice =
          updatePricing && row.fields.price != null ? row.fields.price : null;

        if (mode === "delivery") {
          return client.post("/stock/add", {
            productId,
            branchId,
            quantity: row.qtyChange,
            batchNumber: row.batchNumber || null,
            expiryDate: row.fields.expiryDate ?? null,
            unitCost,
            sellingPrice,
            supplier: null,
            transactionType: "PURCHASE",
          });
        }
        return client.post("/stock/adjust", {
          productId,
          branchId,
          quantity: row.qtyChange,
          reason,
          unitCost,
          sellingPrice,
        });
      }),
    );

    for (const s of settled) {
      if (s.status === "rejected") fail(s.reason);
      else result.stocked++;
      tick();
    }
  }

  return result;
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- execute`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/inventory-import/execute.ts src/lib/inventory-import/execute.test.ts
git commit -m "feat: add two-phase batched inventory import executor

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Export builder

**Files:**
- Create: `src/lib/inventory-import/export.ts`
- Test: `src/lib/inventory-import/export.test.ts`

**Interfaces:**
- Consumes: `toCSV` (Task 1); `MatchableProduct`, `CategoryRef` (Task 2).
- Produces: `buildExportRows(products, categories): Record<string, string | number>[]` and `buildExportCsv(products, categories): string`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/inventory-import/export.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- export`
Expected: FAIL — cannot resolve `@/lib/inventory-import/export`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/inventory-import/export.ts`:

```ts
import dayjs from "dayjs";
import { toCSV } from "@/lib/csv";
import type { CategoryRef, MatchableProduct } from "./types";

export const buildExportRows = (
  products: MatchableProduct[],
  categories: CategoryRef[],
): Record<string, string | number>[] =>
  products.map((p) => ({
    SKU: p.sku ?? "",
    Name: p.name ?? "",
    Category: categories.find((c) => c.id === p.category_id)?.name ?? "",
    Barcode: p.barcode ?? "",
    Cost: Number(p.cost ?? 0).toFixed(2),
    Price: Number(p.price ?? 0).toFixed(2),
    "Expiry Date": p.expiry_date
      ? dayjs(p.expiry_date).format("YYYY-MM-DD")
      : "",
    "Requires Prescription": p.requires_prescription ? "Yes" : "No",
    "Track Inventory": p.track_inventory === false ? "No" : "Yes",
    Status: p.status,
    // Reference only — the import ignores this column.
    "Current Stock": p.currentStock,
    // Fill-in columns, deliberately blank.
    "Qty Change": "",
    "Batch No": "",
  }));

export const buildExportCsv = (
  products: MatchableProduct[],
  categories: CategoryRef[],
): string => toCSV(buildExportRows(products, categories));
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- export`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory-import/export.ts src/lib/inventory-import/export.test.ts
git commit -m "feat: add unified inventory CSV export builder

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Preview table component

**Files:**
- Create: `src/components/inventory-import/ImportPreviewTable.tsx`

**Interfaces:**
- Consumes: `PlanRow` (Task 2).
- Produces: `<ImportPreviewTable rows={PlanRow[]} showAll={boolean} updatePricing={boolean} />`

No unit tests — verified manually in Task 12. Keep it presentational: no data fetching, no HTTP.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import type { PlanRow } from "@/lib/inventory-import/types";

const STATUS_STYLE: Record<PlanRow["status"], { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-800 border-blue-200" },
  update: { label: "Update", className: "bg-amber-100 text-amber-800 border-amber-200" },
  "stock-only": {
    label: "Stock only",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  unchanged: { label: "Unchanged", className: "bg-gray-100 text-gray-600 border-gray-200" },
  error: { label: "Error", className: "bg-red-100 text-red-800 border-red-200" },
};

interface Props {
  rows: PlanRow[];
  showAll: boolean;
  updatePricing: boolean;
}

const ImportPreviewTable = ({ rows, showAll, updatePricing }: Props) => {
  // Errors are always visible; unchanged rows are hidden unless asked for.
  const visible = useMemo(
    () => rows.filter((r) => showAll || r.status !== "unchanged"),
    [rows, showAll],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  if (visible.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-500">
        No changes detected. Nothing will be sent.
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[45vh] overflow-auto rounded-md border border-gray-200"
    >
      <div className="sticky top-0 z-10 grid grid-cols-[7rem_1fr_8rem_7rem_6rem] gap-2 border-b bg-emerald-50 px-3 py-2 text-xs font-bold text-gray-800">
        <span>SKU</span>
        <span>Name / change</span>
        <span>Status</span>
        <span className="text-right">Stock</span>
        <span className="text-right">Qty</span>
      </div>

      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((v) => {
          const row = visible[v.index];
          const style = STATUS_STYLE[row.status];
          return (
          {/* NOTE: this comment belongs ABOVE the `return (`, as a plain JS
              block comment. A {/* … *""/} JSX comment cannot sit here — the map
              callback returns a single root element, so there is no enclosing
              JSX to host a comment child. */}
          /* Rows are variable height — an update row stacks a name, a
             changed-fields line and a "matched by" line. estimateSize is only
             the first-paint guess; measureElement feeds the real height back,
             and data-index is how the virtualizer maps it to this row. Do NOT
             set an explicit height here or measurement is defeated and rows
             overlap. */
            <div
              key={row.lineNumber}
              data-index={v.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 grid w-full grid-cols-[7rem_1fr_8rem_7rem_6rem] items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm"
              style={{ transform: `translateY(${v.start}px)` }}
            >
              <span className="truncate font-mono text-xs">{row.sku || "—"}</span>
              <span className="min-w-0">
                <span className="block truncate">{row.name || "—"}</span>
                {row.status === "error" && (
                  <span className="block truncate text-xs text-red-600">
                    {row.errorMessage}
                  </span>
                )}
                {row.status === "update" && (
                  <span className="block truncate text-xs text-gray-500">
                    {row.changedFields
                      .filter(
                        (c) =>
                          updatePricing || (c.field !== "Cost" && c.field !== "Price"),
                      )
                      .map((c) => `${c.field}: ${c.from || "—"} → ${c.to || "—"}`)
                      .join(" · ")}
                  </span>
                )}
                {row.matchedBy && row.status !== "error" && (
                  <span className="block text-xs text-gray-400">
                    matched by {row.matchedBy}
                  </span>
                )}
              </span>
              <span>
                <Badge variant="outline" className={style.className}>
                  {style.label}
                </Badge>
              </span>
              <span className="text-right tabular-nums">
                {row.currentStock == null
                  ? "—"
                  : row.qtyChange === 0
                    ? row.currentStock
                    : `${row.currentStock} → ${row.resultingStock}`}
              </span>
              <span className="text-right tabular-nums">
                {row.qtyChange === 0 ? "—" : row.qtyChange > 0 ? `+${row.qtyChange}` : row.qtyChange}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImportPreviewTable;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/inventory-import/ImportPreviewTable.tsx
git commit -m "feat: add virtualized import preview table

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Import dialog component

**Files:**
- Create: `src/components/inventory-import/InventoryImportDialog.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces:

```tsx
<InventoryImportDialog
  open={boolean}
  onOpenChange={(open: boolean) => void}
  products={MatchableProduct[]}
  categories={CategoryRef[]}
  branches={{ id: number; name: string }[]}
  defaultBranchId={number | null}
  onDone={() => void}
/>
```

`onDone` is called after a successful apply so the page can refetch.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { buildImportPlan } from "@/lib/inventory-import/plan";
import { executeImportPlan } from "@/lib/inventory-import/execute";
import type {
  CategoryRef,
  ImportMode,
  ImportPlan,
  MatchableProduct,
} from "@/lib/inventory-import/types";
import ImportPreviewTable from "./ImportPreviewTable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: MatchableProduct[];
  categories: CategoryRef[];
  branches: { id: number; name: string }[];
  defaultBranchId: number | null;
  onDone: () => void;
}

const InventoryImportDialog = ({
  open,
  onOpenChange,
  products,
  categories,
  branches,
  defaultBranchId,
  onDone,
}: Props) => {
  const [fileText, setFileText] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("delivery");
  const [branchId, setBranchId] = useState<number | null>(defaultBranchId);
  const [reason, setReason] = useState("Physical count correction");
  const [updatePricing, setUpdatePricing] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Recomputed whenever mode or the pricing flag changes, because both change
  // which rows count as changed (spec 3.1).
  const plan: ImportPlan | null = useMemo(() => {
    if (!fileText) return null;
    return buildImportPlan({
      text: fileText,
      products,
      categories,
      mode,
      updatePricing,
    });
  }, [fileText, products, categories, mode, updatePricing]);

  // Radix keeps this component mounted while the dialog is closed, so plain
  // useState would capture the branch once at page mount. Without this resync,
  // switching branch via BranchSwitcher and then opening the importer silently
  // targets the OLD branch — a delivery lands in the wrong store.
  useEffect(() => {
    if (open) setBranchId(defaultBranchId);
  }, [open, defaultBranchId]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFileText((ev.target?.result as string) ?? "");
    reader.onerror = () => toast.error("Failed to read the file");
    reader.readAsText(file);
    e.target.value = "";
  };

  const reset = () => {
    setFileText(null);
    setShowAll(false);
    setProgress(null);
  };

  const canConfirm =
    !!plan &&
    plan.summary.changes > 0 &&
    branchId != null &&
    (mode === "delivery" || reason.trim().length > 0) &&
    !applying;

  const handleConfirm = async () => {
    if (!plan || branchId == null) return;
    setApplying(true);
    // Left null until the executor's first tick. The executor computes its own
    // total (phase-1 rows plus rows needing a stock call), so guessing one here
    // from summary.changes would render a number that jumps on first update.
    setProgress(null);
    try {
      const result = await executeImportPlan(plan.rows, {
        client: api,
        mode,
        branchId,
        reason: reason.trim(),
        updatePricing,
        overwriteExisting,
        categories,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} created`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.stocked) parts.push(`${result.stocked} stock rows`);
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      if (result.failed) parts.push(`${result.failed} failed`);

      if (result.failed > 0 && result.created + result.updated + result.stocked === 0) {
        toast.error(`Import failed: ${result.firstError}`);
      } else {
        toast.success(parts.join(", ") || "Nothing to do");
        if (result.failed > 0) toast.error(`First error: ${result.firstError}`);
      }

      reset();
      onOpenChange(false);
      onDone();
    } catch (err) {
      // executeImportPlan handles per-row failures itself and reports them in
      // its result, so reaching here means something structural broke — a
      // dropped connection, an expired token. Without this catch the spinner
      // would simply stop with no message, leaving the user unsure what landed.
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        `Import failed: ${e?.response?.data?.message ?? e?.message ?? "Unknown error"}`,
      );
    } finally {
      setApplying(false);
      setProgress(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Guard every close route at the source. shadcn's DialogContent renders
        // its own X button, which no onEscapeKeyDown/onInteractOutside handler
        // can intercept — without this, a user could dismiss the dialog and
        // lose all sight of an import that is still issuing writes.
        if (applying && !next) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-5xl"
        // An import in flight is issuing real writes. Let Radix dismiss the
        // dialog and the user loses all sight of it while it keeps running.
        onEscapeKeyDown={(e) => {
          if (applying) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (applying) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Import inventory CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Mode</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === "delivery" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("delivery")}
                >
                  Delivery
                </Button>
                <Button
                  type="button"
                  variant={mode === "adjustment" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("adjustment")}
                >
                  Adjustment
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="import-branch">Target branch</Label>
              <select
                id="import-branch"
                className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
                value={branchId ?? ""}
                onChange={(e) =>
                  setBranchId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Select a branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {mode === "adjustment" && (
              <div className="space-y-1">
                <Label htmlFor="import-reason">Reason</Label>
                <Input
                  id="import-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Physical count correction"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={updatePricing}
                onCheckedChange={(v) => setUpdatePricing(v === true)}
              />
              Update cost &amp; price from CSV
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={overwriteExisting}
                onCheckedChange={(v) => setOverwriteExisting(v === true)}
              />
              Overwrite existing products
            </label>
          </div>

          <div>
            <Label htmlFor="import-file" className="cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-300 px-3 py-2 text-sm">
                <Upload className="h-4 w-4 text-emerald-600" />
                {fileText ? "Choose a different file" : "Choose CSV file"}
              </span>
            </Label>
            <input
              id="import-file"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFile}
            />
            <p className="mt-2 text-xs text-gray-500">
              Needs a <code>Qty Change</code> column (<code>Total Stock</code> and{" "}
              <code>Adjustment</code> also accepted). Columns you leave out are not
              touched.
            </p>
          </div>

          {plan && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {plan.summary.rowsRead.toLocaleString()} rows read ·{" "}
                  <strong>{plan.summary.changes.toLocaleString()} changes</strong> ·{" "}
                  {plan.summary.unchanged.toLocaleString()} unchanged
                  {showAll ? "" : " (hidden)"} · {plan.summary.errors} errors
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? "Show changes only" : "Show all rows"}
                </Button>
              </div>

              {plan.unknownColumns.length > 0 && (
                <p className="text-xs text-gray-500">
                  Ignored columns: {plan.unknownColumns.join(", ")}
                </p>
              )}

              <ImportPreviewTable
                rows={plan.rows}
                showAll={showAll}
                updatePricing={updatePricing}
              />
            </>
          )}

          {branchId == null && (
            <p className="text-sm text-amber-700">
              You are viewing all branches. Pick a target branch before importing.
            </p>
          )}
        </div>

        <DialogFooter>
          {progress && (
            <span className="mr-auto text-sm text-gray-500">
              {progress.done} / {progress.total}
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {applying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
              </>
            ) : (
              `Import ${plan?.summary.changes ?? 0} changes`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryImportDialog;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/inventory-import/InventoryImportDialog.tsx
git commit -m "feat: add unified inventory import dialog

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Wire into the products page and remove the old CSV code

**Files:**
- Modify: `src/app/products/page.tsx`

**Interfaces:**
- Consumes: `buildExportCsv` (Task 7), `downloadCSV` (Task 1), `InventoryImportDialog` (Task 9).
- Produces: nothing for later tasks.

- [ ] **Step 1: Delete the old CSV code**

Remove from `src/app/products/page.tsx`:

- the `ImportRow` interface (lines ~124-139)
- `handleExportCSV` (lines ~306-348)
- `handleImportCSV` (lines ~351-438)
- `runImport` (lines ~444-548)
- the `pendingImport` state and its overwrite-confirm dialog
- the `importLoading` state

Keep the `Download` and `Upload` lucide imports — the new buttons still use them.

- [ ] **Step 2: Add the new imports and state**

Near the other imports:

```tsx
import { downloadCSV } from "@/lib/csv";
import { buildExportCsv } from "@/lib/inventory-import/export";
import InventoryImportDialog from "@/components/inventory-import/InventoryImportDialog";
import type { MatchableProduct } from "@/lib/inventory-import/types";
```

With the other `useState` calls:

```tsx
const [importOpen, setImportOpen] = useState(false);
```

- [ ] **Step 3: Add the products → MatchableProduct adapter**

The page's `Product` is wider than the import library needs, and `currentStock` must be resolved for the active branch. Add near the other `useMemo`s:

```tsx
// The import library takes a narrow product shape so it stays independent of
// this page's Product interface. current_stock is branch-scoped, so resolve it
// against the branch the user is actually looking at.
const toMatchable = useCallback(
  (p: Product): MatchableProduct => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode ?? null,
      cost: p.cost,
      price: p.price,
      expiry_date: p.expiry_date ?? null,
      requires_prescription: p.requires_prescription,
      track_inventory: p.track_inventory,
      status: p.status,
      category_id: p.category_id,
    currentStock: getStockForBranch(p, activeBranchId ?? null),
  }),
  [activeBranchId],
);

// Full catalogue — the dialog matches CSV rows against this. Must NOT be the
// filtered list, or a filtered-out SKU would be treated as a new product.
const matchableProducts = useMemo(
  () => products.map(toMatchable),
  [products, toMatchable],
);

// What Export CSV writes: only the rows the user currently has in view.
const exportProducts = useMemo(
  () => filtered.map(toMatchable),
  [filtered, toMatchable],
);
```

- [ ] **Step 4: Add the new export handler**

```tsx
// Exports the FILTERED view, matching what the user is looking at and what
// the old products export did. Safe with a partial file: the import only
// touches columns present in the header and only sends rows that changed, so
// products absent from the file are left alone.
//
// Note this is deliberately NOT the same list handed to the dialog. The dialog
// needs every product for matching — give it the filtered list and any
// filtered-out SKU in the CSV would look unmatched and be created as a
// DUPLICATE product.
const handleExportCSV = () => {
  if (exportProducts.length === 0) {
    toast.error("Nothing to export");
    return;
  }
  const csv = buildExportCsv(exportProducts, categories);
  downloadCSV(`inventory_${dayjs().format("YYYY-MM-DD_HHmm")}.csv`, csv);
  toast.success(`Exported ${exportProducts.length} products`);
};
```

- [ ] **Step 5: Replace the toolbar import control**

The old hidden-file-input block sits at roughly lines 1092-1131. Replace the *import* half with a plain button; leave the export button calling the new `handleExportCSV`:

```tsx
<Button variant="outline" onClick={() => setImportOpen(true)}>
  <Upload className="h-4 w-4 mr-2 text-emerald-600" />
  Import CSV
</Button>
```

- [ ] **Step 6: Mount the dialog**

Just before the page's closing wrapper element, alongside the other dialogs:

```tsx
<InventoryImportDialog
  open={importOpen}
  onOpenChange={setImportOpen}
  products={matchableProducts}
  categories={categories}
  branches={branches}
  defaultBranchId={activeBranchId ?? null}
  onDone={() => {
    fetchProducts();
    fetchCategories();
  }}
/>
```

`fetchProducts` (line 550), `fetchCategories` (572), `fetchBranches` (581), and the `branches` state (203) all already exist in this file. Reuse them; do not add new ones.

Note `activeBranchId` is defined at line 194 as `user?.current_branch_id ?? user?.branch_id ?? null` — snake_case, unlike the `user?.currentBranch ?? user?.branch` used on the stock pages. Use this page's existing variable.

- [ ] **Step 7: Verify it compiles and the page loads**

```bash
npx tsc --noEmit
npm run lint
npm run dev
```

Open `http://localhost:3000/products`. The toolbar shows one Export CSV and one Import CSV button. Clicking Import opens the dialog.

- [ ] **Step 8: Commit**

```bash
git add src/app/products/page.tsx
git commit -m "feat: use the unified inventory import on the products page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Hide brand name, generic name, dosage, and form

**Files:**
- Modify: `src/app/products/page.tsx`

- [ ] **Step 1: Remove the form inputs**

Delete the four `<Input>` blocks and their `<Label>`s in the create/edit modal: Brand Name (~1810-1828), Generic Name (~1830-1845), Dosage (~1860-1870), Form (~1872-1885). Line numbers shift as you delete — search for `formData.brand_name`, `formData.generic_name`, `formData.dosage`, `formData.form` and remove each block.

- [ ] **Step 2: Remove them from form state**

In the `formData` initial state (~lines 208-215) and the reset block (~631-638), delete the `brand_name`, `generic_name`, `dosage`, and `form` keys. In `handleOpenModal` (~608-615), delete the four lines that seed them from the product.

- [ ] **Step 3: Remove them from the submit payload**

In `handleSubmit`, delete the destructured `brand_name`, `generic_name`, `dosage`, `form` (~660-666) and the four payload keys `brandName`, `genericName`, `dosage`, `form` (~690-697).

Omitting them means the server preserves whatever is stored — that is the intended behavior, not a bug.

- [ ] **Step 4: Remove the table subtitle**

Delete the `{prod.brand_name}` element at ~line 1598 and its wrapper if the wrapper then has no children.

- [ ] **Step 5: Leave the Product interface and the search filter alone**

Do **not** remove `brand_name` or `generic_name` from the `Product` interface, and do **not** touch the client-side search at ~lines 902-903. Products stay findable by brand even though brand is no longer displayed. This matches the API, which still searches those columns.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run lint
```

Then in the browser: open a product for editing, confirm the four fields are gone, save it, and confirm via the API that the stored values survived:

```bash
docker exec -i cm-pharmacy-db psql -U cmpharmacy -d cm_pharmacy -c "select id, name, brand_name, generic_name, dosage, form from products order by id limit 5;"
```

The values must be unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/app/products/page.tsx
git commit -m "feat: hide brand name, generic name, dosage and form in the UI

Fields stay in the DB and remain searchable; they are no longer shown
or editable.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Strip CSV from the stock pages

**Files:**
- Modify: `src/app/stock/add/page.tsx`
- Modify: `src/app/stock/adjust/page.tsx`

- [ ] **Step 1: Strip `stock/add/page.tsx`**

Delete: the `ImportPreviewRow` interface (67-79), `parseCSVLine` (81-99), `parseCSVDate` (104-108), the state at 134-138 (`importLoading`, `importPreview`, `importConfirmLoading`, `updatePricingOnImport`), `handleExportCSV` (207-245), `handleImportCSV` (247-346), `handleConfirmImport` (348-~410), the matched/unmatched derived lists (~417-419), and the whole toolbar + preview JSX block (~530-860).

Keep the manual single-product form and its `api.post("/stock/add", …)` at line 184.

- [ ] **Step 2: Add a pointer to the products page**

Where the CSV buttons used to be:

```tsx
<p className="text-sm text-gray-500">
  Importing a delivery from a spreadsheet?{" "}
  <Link href="/products" className="text-emerald-700 underline">
    Use the products page
  </Link>
  .
</p>
```

Add `import Link from "next/link";` if it is not already imported.

- [ ] **Step 3: Strip `stock/adjust/page.tsx`**

Delete: the `ImportPreviewRow` interface (70-80), `parseCSVLine` (82-~104), `ADJUSTMENT_HEADERS` (106), the state at 137-144, `handleExportCSV` (265-301), `handleImportCSV` (303-405), `handleConfirmImport` (407-~480), the derived lists (~485-487), and the toolbar + preview JSX (~628-1040).

Keep the manual form and its `api.post("/stock/adjust", …)` at line 206 and `api.post("/stock/loss", …)` at line 242.

- [ ] **Step 4: Add the same pointer**

Same snippet as Step 2.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

`npm run build` matters here — dead imports left behind after deleting large JSX blocks surface as build errors, not type errors.

Then check both pages in the browser: no Export/Import CSV buttons, the manual forms still submit.

- [ ] **Step 6: Commit**

```bash
git add src/app/stock/add/page.tsx src/app/stock/adjust/page.tsx
git commit -m "refactor: remove CSV import/export from the stock pages

Bulk work now lives on the products page. The manual single-product
forms are unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: End-to-end manual verification

The project has no integration tests, so the spec's acceptance cases are run by hand against a local stack. Every case must pass before this feature is considered done.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-unified-inventory-import-design.md` (tick off results)

- [ ] **Step 1: Start the stack**

```bash
cd "C:/Web Projects/CM Pharmacy/CM-Pharmacy-API" && npm run db:up && npm run dev
# separate shell
cd "C:/Web Projects/CM Pharmacy/CM-Pharmacy-UI" && npm run dev
```

- [ ] **Step 2: Run each case, recording pass/fail**

Open DevTools → Network before each import and count requests. The toast is not evidence — it will happily report "0 changes" after firing thousands of no-op requests.

1. Export from the products page, re-import unchanged, delivery mode → preview reports **0 changes**, the confirm button is disabled, **zero HTTP requests**, and no new rows on `/logs`.
2. Same file, edit one product's Name and one product's `Qty Change` → exactly 2 rows shown, exactly 2 requests sent.
3. Same file, pricing checkbox off, edit only a `Cost` cell → 0 changes. Tick the checkbox → that row appears as `update`.
4. Hand-built two-column `SKU,Qty Change` file, delivery mode → stock rises and **no product field is blanked**. Verify with:
   ```bash
   docker exec -i cm-pharmacy-db psql -U cmpharmacy -d cm_pharmacy -c "select sku, name, barcode, cost, price, expiry_date from products where sku = 'BG1';"
   ```
5. File with one unmatched SKU plus a `Qty Change` → the product is created **and** stocked in one run.
6. Delivery mode with a negative `Qty Change` → the row shows an error and is excluded; other rows still import.
7. Adjustment mode with the reason cleared → confirm stays disabled.
8. Admin in all-branches mode → the branch selector is empty, confirm is blocked, the amber hint shows. Pick a branch → stock lands in that branch only.
9. A product named `5" Syringe` → matches, does not error.
10. An old `stock_*.csv` export with a `Total Stock` header → still moves stock.
11. An old `products_*.csv` export with `Brand Name`/`Dosage` headers → imports without errors; those columns are ignored.
12. The products page shows no brand/generic/dosage/form. Edit and save a product that has those values stored → they survive in the DB.

- [ ] **Step 3: Fix anything that fails, then re-run the affected case**

- [ ] **Step 4: Run the full check**

```bash
cd "C:/Web Projects/CM Pharmacy/CM-Pharmacy-UI"
npm test && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 5: Commit**

Stage explicitly — `git add -A` would sweep in the unrelated uncommitted
`src/app/favicon.ico` deletion that predates this branch.

```bash
git add docs/superpowers/specs/2026-08-09-unified-inventory-import-design.md
git commit -m "docs: record manual verification results for unified import

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **The `@` alias** resolves to `./src` via `tsconfig.json`. `vite-tsconfig-paths` makes Vitest honour it, which is why Task 1 installs it.
- **Do not add a bulk import endpoint.** The spec explicitly rejects it — the problem being solved is user confusion, not throughput.
- **`getStockForBranch(product, branchId)`** already exists at `products/page.tsx:146`. Reuse it; do not write a second one.
- **When `activeBranchId` is null the user is viewing all branches.** `getStockForBranch` returns `totalStock` in that case, which is right for display but meaningless as a stock target — hence the required branch picker.
- **If a step's line numbers no longer match**, trust the symbol names over the numbers. The files are edited across several tasks and everything below an edit shifts.
