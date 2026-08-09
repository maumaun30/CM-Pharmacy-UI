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
