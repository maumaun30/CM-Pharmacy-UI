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

it("still moves stock for an update row when overwriteExisting is false", async () => {
  const client = fakeClient();
  const result = await run(
    [
      row({
        status: "update",
        matchedProduct: product,
        fields: { name: "X" },
        changedFields: [{ field: "Name", from: "Biogesic", to: "X" }],
        qtyChange: 25,
      }),
    ],
    client,
    { overwriteExisting: false },
  );
  expect(client.put).not.toHaveBeenCalled();
  expect(result.skipped).toBe(1);
  expect(client.post).toHaveBeenCalledWith(
    "/stock/add",
    expect.objectContaining({ productId: 1, quantity: 25 }),
  );
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

it("creates an unknown category once for two update rows naming it", async () => {
  const client = fakeClient();
  client.post.mockImplementation(async (url: string) => {
    if (url === "/categories") return { data: { id: 77, name: "Vitamins" } };
    return { data: {} };
  });
  const updateRow = (lineNumber: number, sku: string) =>
    row({
      lineNumber,
      status: "update",
      sku,
      matchedProduct: { ...product, sku },
      fields: { categoryName: "Vitamins" },
      changedFields: [{ field: "Category", from: "Analgesic", to: "Vitamins" }],
    });
  await run([updateRow(2, "BG1"), updateRow(3, "BG2")], client);
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

it("reports progress that reaches its total", async () => {
  const client = fakeClient();
  const onProgress = vi.fn();
  await run(
    [
      row({ status: "stock-only", matchedProduct: product, qtyChange: 1 }),
      row({
        lineNumber: 3,
        status: "update",
        matchedProduct: product,
        fields: { name: "X" },
        changedFields: [{ field: "Name", from: "Biogesic", to: "X" }],
        qtyChange: 0,
      }),
    ],
    client,
    { onProgress },
  );
  // 2 actionable rows tick in phase 1; only 1 of them has a nonzero quantity
  // and ticks again in phase 2 — total is 3, and the final call must reach it.
  const [finalDone, finalTotal] =
    onProgress.mock.calls[onProgress.mock.calls.length - 1];
  expect(finalTotal).toBe(3);
  expect(finalDone).toBe(finalTotal);
});
