"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Upload } from "lucide-react";

import api from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  /**
   * The branch the BranchSwitcher is on. There is deliberately no picker in
   * here: a second branch control is a second thing to get wrong, and a stale
   * one silently lands a delivery in the wrong store. Read straight from the
   * prop — never copied into state, so it cannot go stale while Radix keeps
   * this component mounted between opens.
   */
  branchId: number | null;
  branchName: string;
  onDone: () => void;
}

const InventoryImportDialog = ({
  open,
  onOpenChange,
  products,
  categories,
  branchId,
  branchName,
  onDone,
}: Props) => {
  const [fileText, setFileText] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("delivery");
  const [reason, setReason] = useState("Physical count correction");
  const [showAll, setShowAll] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Recomputed on mode change: delivery adds to stock where adjustment sets a
  // delta, so the same file yields different resulting quantities (spec 3.1).
  const plan: ImportPlan | null = useMemo(() => {
    if (!fileText) return null;
    return buildImportPlan({ text: fileText, products, categories, mode });
  }, [fileText, products, categories, mode]);

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
        categories,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} created`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.stocked) parts.push(`${result.stocked} stock rows`);
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
        // sm:max-w-5xl, not max-w-5xl. DialogContent's own classes end in
        // `sm:max-w-lg`; an unprefixed override is a different tailwind-merge
        // group, so both survive and the sm: variant wins above 640px — the
        // dialog silently stays 32rem wide. The prefix must match to replace it.
        className="sm:max-w-5xl"
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

        {/* min-w-0: DialogContent is a grid, and grid children default to
            min-width:auto — without this the preview table's min-width pushes
            this column wider than the dialog instead of scrolling inside it. */}
        <div className="min-w-0 space-y-5">
          {/* items-end: Reason is the second column but belongs beside Mode,
              which sits at the bottom of the first. Bottom-aligning the cells
              lines the input up with the mode buttons instead of with Active
              branch two rows above it. */}
          <div className="grid items-end gap-5 sm:grid-cols-2">
            <div className="space-y-4">
              {branchId != null && (
                <div className="space-y-2">
                  <Label>Active branch</Label>
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <Building2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate">{branchName}</span>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Mode</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={mode === "delivery" ? "default" : "outline"}
                    onClick={() => setMode("delivery")}
                  >
                    Delivery
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "adjustment" ? "default" : "outline"}
                    onClick={() => setMode("adjustment")}
                  >
                    Adjustment
                  </Button>
                </div>
              </div>
            </div>

            {mode === "adjustment" && (
              <div className="space-y-2">
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
            {/* whitespace-nowrap on each code span: without it a narrow dialog
                breaks "Qty Change" across two lines and it stops reading as one
                column name. */}
            <p className="mt-2 text-xs text-gray-500">
              Needs a <code className="whitespace-nowrap">Qty Change</code> column
              (<code className="whitespace-nowrap">Total Stock</code> and{" "}
              <code className="whitespace-nowrap">Adjustment</code> also accepted).
              Columns you leave out are not touched.
            </p>
          </div>

          {plan && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {plan.summary.rowsRead.toLocaleString()} rows read ·{" "}
                  <strong>
                    {plan.summary.changes.toLocaleString()}{" "}
                    {plan.summary.changes === 1 ? "change" : "changes"}
                  </strong>{" "}
                  · {plan.summary.unchanged.toLocaleString()} unchanged
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

              <ImportPreviewTable rows={plan.rows} showAll={showAll} />
            </>
          )}

          {branchId == null && (
            <p className="text-sm text-amber-700">
              No active branch. Pick one in the branch switcher at the top before
              importing — stock is stored per branch.
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
              `Import ${plan?.summary.changes ?? 0} ${
                plan?.summary.changes === 1 ? "change" : "changes"
              }`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryImportDialog;
