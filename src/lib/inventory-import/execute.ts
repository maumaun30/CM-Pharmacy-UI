import type {
  CategoryRef,
  ImportMode,
  ImportResult,
  PlanRow,
} from "./types";

export interface ImportApiClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structurally mirrors AxiosResponse<any>
  post: (url: string, body: unknown) => Promise<{ data: any }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structurally mirrors AxiosResponse<any>
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
    // .trim() matters: a whitespace-only cell is truthy, and the API's
    // `if (!name)` check does not catch it — it would create a category
    // literally named "   ". Must match the per-row guard below.
    if (row.fields.categoryName?.trim()) {
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
          // /stock/add writes a non-null expiry onto the product itself, so
          // sending it here too would double-write. Every other case must go
          // on the product upsert: adjustment mode makes no stock call, a
          // zero-qty row never reaches phase 2, and a deliberate blank (null)
          // is ignored by /stock/add's `if (expiryDate)` guard so it would
          // never clear.
          const stockAddSetsExpiry =
            mode === "delivery" && row.qtyChange !== 0 && f.expiryDate != null;
          if (f.expiryDate !== undefined && !stockAddSetsExpiry)
            body.expiryDate = f.expiryDate;
          if (f.requiresPrescription !== undefined)
            body.requiresPrescription = f.requiresPrescription;
          if (f.trackInventory !== undefined) body.trackInventory = f.trackInventory;
          if (f.status !== undefined) body.status = f.status;
          // Blank means "say nothing about category" — the same guard
          // normalize.ts applies. Without it, categoryId("") finds no match,
          // POSTs a category with an empty name, gets a 400, and the row's
          // phase-1 promise rejects — taking its stock movement down with it.
          if (f.categoryName !== undefined && f.categoryName.trim() !== "")
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
        // Same rule as the update path: only skip it when /stock/add will
        // actually set it. A new product with an expiry and no quantity would
        // otherwise be created with a null expiry.
        const newStockAddSetsExpiry =
          mode === "delivery" && row.qtyChange !== 0 && f.expiryDate != null;
        if (f.expiryDate !== undefined && !newStockAddSetsExpiry)
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
