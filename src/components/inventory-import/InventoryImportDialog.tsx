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
