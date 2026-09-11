"use client";

// app/time/audit/page.tsx — admin only
// Append-only record of every write: who, what changed, and where it came from.
// Backed by the shared `logs` table the whole API already writes to, filtered to
// the time-tracking modules — there is no second audit trail to keep in sync.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useConsole } from "../_components/ConsoleShell";
import { getAudit, type AuditEntry } from "@/lib/time";
import { CARD, MONO, SOURCE_PILL } from "../_lib/tokens";

const GRID =
  "grid min-w-[720px] grid-cols-[150px_minmax(160px,1fr)_minmax(240px,2fr)_120px] gap-[10px] px-[18px]";

export default function AuditPage() {
  const { isAdmin, refreshToken } = useConsole();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // The sidebar hides this route for managers; this covers a direct URL hit.
  useEffect(() => {
    if (!isAdmin) router.replace("/time");
  }, [isAdmin, router]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { entries: rows } = await getAudit(100);
      setEntries(rows);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  if (!isAdmin) return null;

  return (
    <div className={cn(CARD, "overflow-hidden")}>
      <div className="overflow-x-auto">
        <div
          className={cn(
            GRID,
            "border-b border-[#e2e8f0] bg-[#f8fafc] py-[11px] text-[10.5px] font-bold uppercase leading-[1.2] tracking-[0.06em] text-[#64748b]"
          )}
        >
          <span>When</span>
          <span>Who</span>
          <span>Action</span>
          <span>Source</span>
        </div>

        {entries.map((l) => (
          <div key={l.id} className={cn(GRID, "items-center border-b border-[#f1f5f9] py-[11px]")}>
            <span className={cn("text-[12px] font-medium leading-[1.3] text-[#64748b]", MONO)}>
              {new Date(l.when.replace(" ", "T")).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="truncate text-[13px] font-semibold leading-[1.3] text-[#1e293b]">
              {l.who}
            </span>
            <span className="text-[12.5px] leading-[1.45] text-[#475569]">{l.text}</span>
            <span>
              <span
                className={cn(
                  "rounded-md px-2 py-[3px] text-[10.5px] font-semibold leading-[1.6]",
                  SOURCE_PILL[l.source]
                )}
              >
                {l.source}
              </span>
            </span>
          </div>
        ))}

        {!loading && entries.length === 0 && (
          <div className="min-w-[720px] px-[18px] py-10 text-center text-[12.5px] text-[#94a3b8]">
            Nothing recorded yet.
          </div>
        )}
        {loading && (
          <div className="min-w-[720px] px-[18px] py-10 text-center text-[12.5px] text-[#94a3b8]">
            Loading audit log…
          </div>
        )}
      </div>

      <div className="px-[18px] py-3 text-[11.5px] leading-[1.4] text-[#94a3b8]">
        Audit entries are append-only and retained for 7 years.
      </div>
    </div>
  );
}
