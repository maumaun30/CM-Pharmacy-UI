# Unified Inventory CSV Import — Design

**Date:** 2026-08-09
**Scope:** `CM-Pharmacy-UI` only. No API changes, no DB migration.
**Status:** Approved, ready for implementation planning.

## Problem

The web UI has three separate CSV export/import flows:

| Page | File | Editable column | Writes |
|---|---|---|---|
| Products | `src/app/products/page.tsx:306-548` | product master fields | `POST/PUT /products` |
| Add stock | `src/app/stock/add/page.tsx:207-405` | `Total Stock` | `POST /stock/add` |
| Stock adjustment | `src/app/stock/adjust/page.tsx:265-470` | `Adjustment` | `POST /stock/adjust` |

Users do not know which page to use. They export from one page and import into another, where the
column names do not match and the file silently does nothing useful. This confusion — not import
failure, speed, or data corruption — is the reported pain.

Secondary problems the current split causes:

- The three parsers are near-duplicates that have already drifted. `products/page.tsx:392` still
  strips quotes a second time after `parseCSVLine` has unescaped them, mangling names such as
  `5" Syringe`; both stock pages fixed this. Products also matches on SKU only while the stock
  pages match SKU > Barcode > Name.
- The products import runs sequentially (`await` inside the `for` loop at `products/page.tsx:457`)
  while the stock imports use batched `Promise.allSettled`.
- Creating a product and stocking it requires two files on two pages.

## Goals

1. One export button and one import button in the whole web UI, on the products page.
2. One file can create products, update product fields, and move stock in a single pass.
3. No capability is lost — the manual single-product forms on the stock pages remain.
4. Hide four unused product fields (`brand_name`, `generic_name`, `dosage`, `form`) from the UI.

## Non-goals

- No bulk/transactional import endpoint on the API. The reported pain is confusion, not throughput.
  Per-row HTTP calls in batches of 20 stay.
- No multi-branch-per-file import. One import run targets exactly one branch.
- No DB migration. The four hidden columns keep their data.

## Design

### 1. CSV format

A single file shape, exported from and imported to the products page:

```
SKU, Name, Category, Barcode, Cost, Price, Expiry Date,
Requires Prescription, Track Inventory, Status,
Current Stock, Qty Change, Batch No
```

| Column | Role |
|---|---|
| `SKU` | Primary match key. Required to create a product. |
| `Name` | Product master. Required to create a product. |
| `Category` | Product master. Required to create a product; created on the fly if it does not exist. |
| `Barcode` | Product master. Secondary match key. |
| `Cost`, `Price` | Product master. Always used when *creating* a product (both are required). On an *existing* product, written back only when the pricing checkbox is ticked. |
| `Expiry Date` | Product master (`products.expiry_date`). |
| `Requires Prescription`, `Track Inventory` | Product master. `Yes`/`No`. |
| `Status` | Product master. `ACTIVE`/`INACTIVE`. |
| `Current Stock` | **Export-only reference.** The import ignores this column. It is branch-specific and read-only. |
| `Qty Change` | The one editable stock column. Blank or `0` means no stock movement for that row. |
| `Batch No` | Delivery mode only; ignored in adjustment mode. |

Removed relative to today's three exports: `ID` (never used for matching), `Brand Name`,
`Generic Name`, `Dosage`, `Form` (hidden — see section 5), `Total Stock` and `Adjustment`
(both replaced by `Qty Change`).

Export writes `Current Stock` for the active branch and leaves `Qty Change` and `Batch No` blank
as fill-in columns.

**Header aliases.** On import, `Total Stock` and `Adjustment` are accepted as aliases for
`Qty Change`, so files exported from the old stock pages keep working. First matching header wins;
`Qty Change` takes priority if more than one is present. The dialog's helper text states this.

### 2. Import dialog

The import dialog collects four inputs before the confirm button is enabled.

**Mode** — radio, required.

- `Delivery` — each row with `Qty Change` > 0 posts to `/stock/add` with
  `transactionType: "PURCHASE"`, carrying `batchNumber` and `expiryDate`.
- `Adjustment` — each row with `Qty Change` ≠ 0 posts to `/stock/adjust`. `Batch No` is ignored.

**Target Branch** — select, required. Pre-filled with `user.currentBranch ?? user.branch`. An admin
in all-branches mode (`current_branch_id` null) has no default and must choose; the confirm button
stays disabled until they do. All stock writes in the run use this branch.

**Reason** — text, required in adjustment mode only, hidden in delivery mode. Matches the existing
bulk-adjust requirement at `stock/adjust/page.tsx:410-414`.

**Update cost & price from CSV** — checkbox, default off. Same semantics as the existing
`updatePricingOnImport` flag on both stock pages: when off, `Cost` and `Price` cells are parsed for
display in the preview but not sent.

### 3. Per-row pipeline

Matching runs against a freshly fetched product list (never a stale closure), using three lookup
maps keyed lowercase, in priority order **SKU > Barcode > Name**. This adopts the stock pages'
matcher and replaces the products page's SKU-only matching.

Each row then resolves to one of three outcomes:

**Matched existing product** → `PUT /products/:id`.

The payload contains **only the fields whose header is present in the CSV**. A header that is
absent means the key is omitted from the request body entirely, and the server preserves the
existing value via its `!== undefined` fallback (`productController.js:266-269`). This is the
critical difference from today's behavior — see section 4.

**Unmatched** → `POST /products`.

Requires `Name`, `SKU`, `Category`, `Cost`, `Price`. A missing required field marks the row as an
error in the preview and blocks only that row. The category is looked up case-insensitively and
created via `POST /categories` if absent, with the new category pushed into the local list so
later rows reuse it (existing behavior, `products/page.tsx:475-500`).

A matched row whose product fields are all unchanged (see section 3.1) issues **no product request
at all**.

**Then, if `Qty Change` ≠ 0**, the stock call fires against the resolved product id and the target
branch:

- Delivery: `POST /stock/add` with `{ productId, branchId, quantity, batchNumber, expiryDate, unitCost, sellingPrice, supplier: null, transactionType: "PURCHASE" }`
- Adjustment: `POST /stock/adjust` with `{ productId, branchId, quantity, reason, unitCost, sellingPrice }`

`unitCost` and `sellingPrice` are sent as `null` unless the pricing checkbox is ticked.

Product upserts move onto the same batched `Promise.allSettled` pattern the stock pages already
use (20 concurrent), replacing the sequential loop at `products/page.tsx:457`. Ordering constraint:
within a row the product upsert must complete before its stock call, because a newly created
product has no id until the POST returns. Implement as two phases — batch all product upserts
first, then batch all stock calls against the resolved ids.

### 3.1 Change detection

A full export contains every product, but a real import changes a handful of rows. Sending a
request per row would make a no-op re-import cost one `PUT /products/:id` per product. Each of
those costs four DB round trips — SELECT, UPDATE, `fetchProductWithStocks` re-read, and a
`createLog` INSERT whose metadata embeds the full `{ before, after }` objects
(`productController.js:276-284`) — and writes an "Updated product" audit row for a change that did
not happen, burying real history on the logs page.

So the import diffs client-side and **skips requests for rows with nothing to do**.

A matched row is **changed** if any of these hold:

- a product field present in the CSV differs from the stored value, after normalization
- `Qty Change` ≠ 0
- (unmatched rows are always "new", never diffed)

Values are compared normalized, never as raw strings, or nothing will ever compare equal:

| Field | Normalization |
|---|---|
| `Cost`, `Price` | Parse to number, compare to 2 decimal places. `"10.00"` equals `10`. |
| `Expiry Date` | `dayjs(...).format("YYYY-MM-DD")` on both sides; both empty/null compare equal. |
| `Requires Prescription`, `Track Inventory` | Map `Yes`/`No` to boolean before comparing. |
| `Category` | Compare by resolved category id, not by name string, and case-insensitively. |
| `Name`, `SKU`, `Barcode`, `Status` | Trim; treat `""` and `null` as equal. |

**When the pricing checkbox is off, `Cost` and `Price` differences do not count as changes.** Those
values are not sent, so a row differing only in price has no work to do and must not fire a PUT.

Headers absent from the file are not compared — the same rule that governs which keys are sent
(section 3).

#### Expiry date handling

`Expiry Date` maps to the product master field `products.expiry_date`.

In delivery mode it is *also* sent to `/stock/add`, which writes it to both the stock transaction
row and back onto the product ("newest delivery wins", `stockController.js:226-230`). To avoid
sending it twice, delivery mode omits `expiryDate` from the product upsert and lets `/stock/add`
set it. Rows with no `Qty Change` still carry it on the product upsert.

In adjustment mode `/stock/adjust` has no expiry parameter, so `Expiry Date` is always sent on the
product upsert.

#### Validation, per mode

| Condition | Result |
|---|---|
| Delivery mode, `Qty Change` < 0 | Row error: "Delivery quantities must be positive. Use Adjustment mode to reduce stock." |
| Either mode, `Qty Change` blank or 0 | No stock call. The product upsert still runs. Not an error — most rows in a full export stay blank. |
| Unmatched row missing Name/SKU/Category/Cost/Price | Row error naming the missing field. |
| Unparseable `Qty Change` | Treated as 0 with a preview warning, never as a silent large number. |
| Blank line | Skipped, not counted. |

### 4. Overwrite safety

Existing SKUs still trigger the overwrite-vs-skip prompt currently at `products/page.tsx:418-429`.
The meaning of "overwrite" changes:

- **Today:** every product column is replaced by the CSV value; an empty cell clears the column,
  and a missing header sends `""` which also clears it.
- **New:** only columns whose header appears in the CSV are updated. An empty *cell* under a
  present header still clears that field — that remains the way to blank a value deliberately.

This closes the failure mode where a user edits only the stock columns of an exported sheet, or
hand-builds a two-column `SKU, Qty Change` file, and silently wipes product data.

### 5. Hidden fields

`brand_name`, `generic_name`, `dosage`, and `form` are removed from the UI. All four are already
nullable (`CM-Pharmacy-API/db/schema.js:368-371`), so no migration is needed and no API change is
required — omitting them from a PUT preserves whatever is stored.

Removed from `CM-Pharmacy-UI/src/app/products/page.tsx`:

- the create/edit form modal inputs
- the products table columns
- any sort keys and filter options referencing them
- the form-state interfaces (`formData`, `ImportRow`)
- the CSV export columns and import parsing
- the `{prod.brand_name}` subtitle rendered under the Name cell (`products/page.tsx:1598`)

The `Product` interface **keeps** `brand_name` and `generic_name`, because the page's client-side
search filters on them (`products/page.tsx:902-903`). Dropping them from the type would break that
filter. Keeping it mirrors the API-side decision below: hidden, but still findable.

Deliberately **not** changed:

- DB columns and their existing data.
- The API's product search, which still matches `brandName` and `genericName`
  (`productController.js:73-74`). Keeping it means legacy products remain findable by brand.
- The refund-request product projections at `productController.js:358` and `:412`, which include
  `brand_name`. No frontend renders it, so it is dead weight in the response, not a bug.

Mobile and Admin need no changes — a repo-wide grep confirms these four fields appear only in
`CM-Pharmacy-UI`.

### 6. Code extraction

Create `CM-Pharmacy-UI/src/lib/csv.ts` holding the currently triplicated helpers:

- `parseCSVLine(line: string): string[]` — RFC4180 quote handling. Take the stock pages' version;
  callers must not strip quotes a second time.
- `parseCSVDate(raw: string): string | null` — accepts `YYYY-MM-DD` or anything `dayjs` parses
  (Excel's `M/D/YYYY`), returns null rather than blocking a row.
- `toCSV(rows: Record<string, unknown>[]): string` — header derivation, quoting, escaping.
- `buildProductMatcher(products)` → `match(row): { product, matchedBy }` — the SKU/Barcode/Name
  three-map lookup.

`stock/add/page.tsx` and `stock/adjust/page.tsx` lose their `handleExportCSV`, `handleImportCSV`,
`handleConfirmImport`, import-preview dialogs, `ImportPreviewRow` interfaces, `ADJUSTMENT_HEADERS`,
and the related state (`importPreview`, `importLoading`, `importConfirmLoading`, `importReason`,
`updatePricingOnImport`). Their manual single-product forms are untouched. Expect both files to
shrink by roughly half.

The products page currently sits at 2780 lines. The unified import is materially larger than what
it replaces, so extract the import feature into its own component
(`src/app/products/InventoryImportDialog.tsx` or `src/components/inventory-import/`) rather than
growing the page file further. The page keeps the two toolbar buttons and passes down the product
list, category list, and branch context.

### 7. Preview and result reporting

The preview is built entirely in the browser. The only server request before it renders is the
single `GET /products` refetch already needed for matching, so previewing a large file costs the
server nothing regardless of row count.

**The table shows changed rows only, by default.** A summary line above it reads e.g.
`4,312 rows read · 128 changes · 4,180 unchanged (hidden) · 4 errors`, with a toggle to show all
rows. Errors are always visible regardless of the toggle. Unchanged rows are never sent.

Row statuses:

| Status | Meaning |
|---|---|
| `new` | Will create a product, and stock it if `Qty Change` ≠ 0. |
| `update` | Will `PUT` the differing fields. The changed fields are named in the row. |
| `stock only` | Product fields match; only `Qty Change` fires. |
| `unchanged` | No request. Hidden unless "show all" is toggled on. |
| `error: <reason>` | Excluded from the run; other rows proceed. |

Columns shown: SKU, Name, status, `Current Stock` → resulting stock, `Qty Change`, and — only when
the pricing checkbox is ticked — `Cost` and `Price`. This mirrors the conditional-column behavior
already in `stock/adjust/page.tsx`.

For `update` rows the changed fields are listed as `old → new` so the user sees exactly what the
file will overwrite before confirming. This is the visible half of the section 4 safety change.

Toggling the pricing checkbox re-runs the diff, because it changes which fields count (section 3.1).
Row counts in the summary update live.

Rendering is virtualized or capped — a 5000-row file must not lock the browser. With the
changes-only default this is rarely hit in practice, but "show all" on a full catalog will.

After the run, a single toast summarizes: `created`, `updated`, `stocked`, `skipped`, `failed`.
The first server error message is surfaced verbatim. Failures are per-row and do not abort the
run; there is no rollback, matching current behavior on all three pages.

### 8. Removed UI surfaces

- `stock/add` page: Export CSV and Import CSV buttons, and the import preview dialog.
- `stock/adjust` page: Export CSV and Import CSV buttons, and the import preview dialog.
- Both pages get a short inline note pointing to the products page for bulk work.

## Testing

The project has no test scripts, so verification is manual against a local stack
(`npm run db:up` + `db:bootstrap` in the API, `npm run dev` in both projects). The cases that must
pass before this is considered done:

1. Export from products page, re-import unchanged → preview reports 0 changes, confirm sends
   **zero HTTP requests**, and no new rows appear on the logs page. Verify in the network tab, not
   just by the toast. This is the section 3.1 regression check.
1b. Same file, edit one product's name and one product's `Qty Change` → exactly 2 rows shown,
   exactly 2 requests sent.
1c. Same file with the pricing checkbox off, edit only a `Cost` cell → 0 changes. Tick the
   checkbox → that row appears as `update`.
2. Two-column `SKU, Qty Change` file, delivery mode → stock rises, no product field is blanked.
   This is the section 4 regression check.
3. File with one unmatched SKU and a `Qty Change` → product is created *and* stocked in one run.
4. Delivery mode with a negative `Qty Change` → preview shows a row error, confirm excludes it.
5. Adjustment mode with no reason → confirm stays disabled.
6. Admin in all-branches mode → branch selector is empty and confirm is blocked until a branch is
   picked; after picking, stock lands in that branch only.
7. Product named `5" Syringe` → matches correctly (the quote-stripping regression).
8. Pricing checkbox off → cost and price in the file are ignored; on → both are written.
9. Products page shows no brand/generic/dosage/form anywhere; editing and saving a product that
   *has* those values stored leaves them intact in the DB.

## Risks

- **Users hold old CSV files.** Handled by the header aliases in section 1. Residual risk: an old
  *products* export carries `Brand Name` and friends, whose headers are now unknown and ignored —
  harmless, but the preview should not flag them as errors.
- **Two-phase batching** means a row whose product upsert fails is silently dropped from the stock
  phase. It must still be counted in the `failed` total, not vanish.
- **Mode is per-file, not per-row.** A user with a mixed delivery-and-correction sheet must run it
  twice. This was chosen deliberately over a per-row mode column for simplicity.
- **Under-normalized diffing silently disables changes-only.** If `Cost` compares as `"10.00" !==
  10`, every row reports as changed and the feature reverts to the behavior it was added to
  prevent. Test 1 is the guard: it must assert zero network requests, not just a zero count in the
  toast.
- **Over-normalized diffing silently drops real edits.** The inverse: if trimming or date coercion
  is too aggressive, an intentional edit is classified unchanged and never sent, with no error.
  Test 1b guards this direction.
