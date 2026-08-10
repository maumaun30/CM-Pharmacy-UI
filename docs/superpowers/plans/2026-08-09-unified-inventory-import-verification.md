# Unified Inventory Import — Manual Verification

Four cases. These are the ones where the automated suite proves nothing: every
one of them passes a green test run today and could still be broken.

Run against `http://localhost:3000/products` with the API and Docker Postgres up.

**Your local DB holds production data pulled from the droplet.** Cases 4 and 12
mutate it. Nothing here deletes anything, but a stock adjustment is a real
adjustment. Skip case 4 if you want that snapshot pristine.

Test file already generated for case 4:

```
C:\Users\mauma\AppData\Local\Temp\claude\C--Web-Projects-CM-Pharmacy\6005d8ad-726c-4c59-b055-cb4d0f363133\scratchpad\case4-stock-only.csv
```

Reference data from your local DB: 1633 products, no duplicate SKUs, branches
`1 = Plazang Luma - Arayat`, `2 = San Luis - Main`.

---

## Case 1 — Re-importing an unchanged export sends ZERO requests

The whole feature exists for this. **The toast is not evidence** — it will
happily say "0 changes" after firing 1633 no-op `PUT`s.

1. Open `/products`. Clear any search or category filter.
2. Click **Export CSV**. You get `inventory_<date>_<time>.csv`.
3. Open **DevTools → Network**, clear it, and leave it open.
4. Click **Import CSV**, choose that exact file unmodified, mode **Delivery**,
   pick a target branch.

**Assert:**
- Summary reads `1633 rows read · 0 changes · 1633 unchanged (hidden) · 0 errors`
- The preview table shows the empty state, not 1633 rows
- The confirm button is **disabled** (it requires `changes > 0`)
- Network shows **one** `GET /products` and nothing else

If the summary shows changes on an untouched export, the export's formatting and
the import's normalization disagree — tell me which fields the preview lists.

---

## Case 4 — A two-column file moves stock without blanking anything

This is the regression guard for the overwrite-safety rule: columns absent from
the CSV header must never be sent, because sending `""` clears them.

**Before**, capture the current state:

```bash
docker exec -i cm-pharmacy-db psql -U cmpharmacy -d cm_pharmacy -c \
"select p.sku, p.name, p.barcode, p.cost, p.price, p.expiry_date, p.status, bs.current_stock \
 from products p join branch_stocks bs on bs.product_id=p.id \
 where p.sku in ('680','681','683') and bs.branch_id=1 order by p.sku;"
```

Then import `case4-stock-only.csv` — mode **Adjustment** (it contains a negative),
target branch **Plazang Luma - Arayat**, reason `verification test`.

**Assert in the preview:**
- 2 rows shown, not 3 — SKU `683` has `Qty Change` of 0 and is `unchanged`
- `680` shows `14 → 19`, `681` shows `20 → 17`
- Both rows are status **stock only**, NOT `update` — no product field changed

**Assert after, by re-running the same query:** `name`, `barcode`, `cost`,
`price`, `expiry_date` and `status` are **byte-identical** to before. Only
`current_stock` moved.

If any product column went null or empty, stop and tell me — that is the exact
data-loss bug this design was built to prevent.

To undo: re-import the same file with the signs flipped (`-5`, `3`).

---

## Case 8 — All-branches mode blocks the import until a branch is picked

Stock is branch-scoped; products are global. An admin viewing all branches has
no branch to write stock into.

1. Use the **BranchSwitcher** to select **All branches**.
2. Open **Import CSV** and pick any file with a `Qty Change` column.

**Assert:**
- The **Target branch** select is empty
- An amber line reads *"You are viewing all branches. Pick a target branch before importing."*
- The confirm button is **disabled** even though the preview shows changes
- Choosing a branch enables it

**Then the part that only manual testing catches:** with the dialog closed,
switch branch via the BranchSwitcher, and reopen the importer.

**Assert:** the Target branch now defaults to the branch you just switched to —
not the one selected when the page first loaded. This was a real bug; the
dialog stays mounted while closed, so the default was captured once at page
mount.

---

## Case 12 — The four hidden fields survive an edit

`brand_name`, `generic_name`, `dosage` and `form` are gone from the UI but must
remain in the database. They are omitted from the `PUT` body, and the API
preserves anything omitted.

Pick a product that actually has values — check first:

```bash
docker exec -i cm-pharmacy-db psql -U cmpharmacy -d cm_pharmacy -c \
"select id, sku, name, brand_name, generic_name, dosage, form from products \
 where coalesce(brand_name,'') <> '' or coalesce(generic_name,'') <> '' \
 or coalesce(dosage,'') <> '' or coalesce(form,'') <> '' limit 5;"
```

If that returns nothing, these columns are already empty across the board and
this case is moot — say so and skip it.

Otherwise: open that product's edit modal on `/products`, confirm no Brand Name,
Generic Name, Dosage or Form inputs appear, change **only the price**, save.

**Assert:** re-running the query shows all four values unchanged.

Also confirm the product is still findable by typing its brand name into the
products search box — the filter still matches those columns even though they
are no longer displayed.

---

## Reporting back

For each case: pass, or what you saw instead. For case 1 the network request
count is the answer; for case 4 the before/after query output is.

Known deferred items, not bugs to report:
- Excel strips leading zeros from numeric-looking barcodes (`04800`) on open and
  resave, corrupting them on a later import. Outside our code's reach.
- `Qty Change` of `+5` is rejected; write `5`. One-character fix if it bothers you.
- In all-branches mode the exported `Current Stock` is a cross-branch total. The
  import ignores that column entirely.
