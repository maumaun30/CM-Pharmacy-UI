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
}): ImportPlan => {
  const { text, products, categories, mode } = input;
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
    const lineNumber = i + 2;
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
    // Booleans obey the same absent/blank/unreadable rule as every other
    // field. parseBoolCell returns undefined for BOTH blank and junk, so
    // without this a cell of "Y" or "Required" is silently discarded and the
    // row reports unchanged — the wrong way to fail on a prescription flag.
    const boolCell = (col: CanonicalColumn): boolean | undefined => {
      const raw = at(row, col);
      if (raw === undefined) return undefined; // column absent
      if (!raw.trim()) return undefined; // blank cell: say nothing
      const b = parseBoolCell(raw);
      if (b === undefined) cellErrors.push(`${col} "${raw}" is not Yes or No`);
      return b;
    };

    if (cols.indexOf["Requires Prescription"] !== undefined)
      fields.requiresPrescription = boolCell("Requires Prescription");
    if (cols.indexOf["Track Inventory"] !== undefined)
      fields.trackInventory = boolCell("Track Inventory");
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

    const changedFields = diffProductFields(fields, product, categories);
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
