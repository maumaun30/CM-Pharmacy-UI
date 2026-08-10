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
}

const ImportPreviewTable = ({ rows, showAll }: Props) => {
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
      {/* min-w keeps the columns at their intended widths and lets the table
          scroll sideways instead of crushing the Product column to nothing.
          The fixed columns alone total 22.5rem; in a dialog narrower than that
          plus a readable name, `1fr` collapses and every name truncates to an
          ellipsis. Both the header and the rows' positioning context carry it,
          or they scroll out of alignment with each other. */}
      <div className="min-w-[42rem]">
        <div className="sticky top-0 z-10 grid grid-cols-[5.5rem_1fr_6.5rem_6.5rem_4rem] gap-3 border-b bg-emerald-50 px-3 py-2 text-xs font-bold text-gray-800">
          <span>SKU</span>
          <span>Product</span>
          <span>Status</span>
          <span className="text-right">Stock</span>
          <span className="text-right">Qty</span>
        </div>

        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = visible[v.index];
            const style = STATUS_STYLE[row.status];
            /* Rows are variable height — an update row stacks a name,
               changed-fields line and a "matched by" line. estimateSize is
               only the first-paint guess; measureElement feeds the real
               height back, and data-index is how the virtualizer maps it to
               this row. Do NOT set an explicit height here or measurement is
               defeated and rows overlap. */
            return (
              <div
                key={row.lineNumber}
                data-index={v.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 grid w-full grid-cols-[5.5rem_1fr_6.5rem_6.5rem_4rem] items-start gap-3 border-b border-gray-100 px-3 py-2 text-sm"
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
                <span className="whitespace-nowrap text-right tabular-nums">
                  {row.currentStock == null
                    ? "—"
                    : row.qtyChange === 0
                      ? row.currentStock
                      : `${row.currentStock} → ${row.resultingStock}`}
                </span>
                <span className="whitespace-nowrap text-right tabular-nums">
                  {row.qtyChange === 0
                    ? "—"
                    : row.qtyChange > 0
                      ? `+${row.qtyChange}`
                      : row.qtyChange}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ImportPreviewTable;
