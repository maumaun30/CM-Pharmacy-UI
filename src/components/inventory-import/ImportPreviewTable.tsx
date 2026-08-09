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
            <div
              key={row.lineNumber}
              className="absolute left-0 grid w-full grid-cols-[7rem_1fr_8rem_7rem_6rem] items-center gap-2 border-b border-gray-100 px-3 text-sm"
              style={{ height: v.size, transform: `translateY(${v.start}px)` }}
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
