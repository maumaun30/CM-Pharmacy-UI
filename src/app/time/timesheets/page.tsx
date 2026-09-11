"use client";

// app/time/timesheets/page.tsx
// Filterable entry table with row selection, inline approve/edit and bulk
// approve. Filters compose: branch scope ∧ period ∧ status, all applied by the
// API so a staff-scoped caller cannot widen them from the query string.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Segmented, useConsole } from "../_components/ConsoleShell";
import {
  approveEntries,
  formatClock,
  formatDayLabel,
  formatDuration,
  listEntries,
  PERIOD_LABELS,
  STATUS_LABELS,
  STATUS_TEXT,
  updateEntry,
  type TimeEntry,
} from "@/lib/time";
import { BTN_APPROVE, BTN_EDIT, BTN_SECONDARY, CARD, MONO, STATUS_PILL } from "../_lib/tokens";

/** Shared column track — header, rows and note strips must stay in lockstep. */
const GRID =
  "grid min-w-[980px] grid-cols-[36px_minmax(150px,1.6fr)_minmax(96px,1fr)_92px_92px_78px_92px_116px_150px] gap-2 px-[18px]";

function Checkbox({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-[17px] w-[17px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
        checked ? "border-[#059669] bg-[#059669]" : "border-[#cbd5e1] bg-white hover:border-[#94a3b8]"
      )}
    >
      {checked && <Check className="h-3 w-3 text-white" strokeWidth={4} />}
    </button>
  );
}

/** Editing someone's hours demands a reason — the API rejects it without one. */
function EditDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: TimeEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toLocalInput = (value: string | null) => {
    if (!value) return "";
    const d = new Date(value.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [clockIn, setClockIn] = useState(toLocalInput(entry.clock_in_at));
  const [clockOut, setClockOut] = useState(toLocalInput(entry.clock_out_at));
  const [breakMinutes, setBreakMinutes] = useState(String(entry.break_minutes));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!reason.trim()) {
      toast.error("A reason is required", { description: "It is recorded in the audit log." });
      return;
    }
    setSaving(true);
    try {
      await updateEntry(entry.id, {
        clockInAt: clockIn ? new Date(clockIn).toISOString() : undefined,
        clockOutAt: clockOut ? new Date(clockOut).toISOString() : null,
        breakMinutes: Number(breakMinutes) || 0,
        reason: reason.trim(),
      });
      toast.success("Entry updated", { description: "It returns to pending for approval." });
      onSaved();
      onClose();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not save the edit.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[17px] font-bold text-[#1e293b]">Edit times</div>
        <div className="mt-1 text-[12.5px] text-[#64748b]">
          {entry.staffName} · {formatDayLabel(entry.clock_in_at)}
        </div>

        <label className="mt-4 block text-[12px] font-semibold text-[#475569]">
          Clock in
          <input
            type="datetime-local"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-[#e2e8f0] px-3 py-2 text-[13px] font-normal"
          />
        </label>

        <label className="mt-3 block text-[12px] font-semibold text-[#475569]">
          Clock out
          <input
            type="datetime-local"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-[#e2e8f0] px-3 py-2 text-[13px] font-normal"
          />
        </label>

        <label className="mt-3 block text-[12px] font-semibold text-[#475569]">
          Unpaid break (minutes)
          <input
            type="number"
            min={0}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-[#e2e8f0] px-3 py-2 text-[13px] font-normal"
          />
        </label>

        <label className="mt-3 block text-[12px] font-semibold text-[#475569]">
          Reason (recorded in the audit log)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. till reconciliation overran"
            className="mt-1 w-full rounded-[10px] border border-[#e2e8f0] px-3 py-2 text-[13px] font-normal"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_EDIT}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={cn(BTN_APPROVE, saving && "opacity-60")}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TimesheetsPage() {
  const {
    branchId,
    branchName,
    period,
    setPeriod,
    status,
    setStatus,
    canApprove,
    setEntryCount,
    refreshToken,
    refresh,
  } = useConsole();

  const [rows, setRows] = useState<TimeEntry[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  /** Ids flipped locally ahead of the server, so a pill can revert on failure. */
  const [optimistic, setOptimistic] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    try {
      const data = await listEntries({ period, status, branchId });
      setRows(data.entries);
      setTotalMinutes(data.total_minutes);
      setOptimistic({});
    } catch {
      toast.error("Could not load timesheets.");
    } finally {
      setLoading(false);
    }
  }, [period, status, branchId]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  // The header subtitle quotes the live result count.
  useEffect(() => {
    setEntryCount(rows.length);
    return () => setEntryCount(null);
  }, [rows.length, setEntryCount]);

  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const selectedVisible = visibleIds.filter((id) => selected[id]);
  const allOn = rows.length > 0 && selectedVisible.length === rows.length;

  const toggleAll = () => {
    if (allOn) {
      setSelected({});
      return;
    }
    const next: Record<number, boolean> = {};
    visibleIds.forEach((id) => {
      next[id] = true;
    });
    setSelected(next);
  };

  const toggleRow = (id: number) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  // Optimistic: pills flip immediately, and revert with a toast on failure.
  const approve = async (ids: number[]) => {
    if (ids.length === 0) return;
    setOptimistic((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    setSelected({});

    try {
      const res = await approveEntries(ids);
      toast.success(
        res.approved === 0
          ? "Already approved"
          : `Approved ${res.approved} ${res.approved === 1 ? "entry" : "entries"}`
      );
      refresh();
    } catch (err) {
      setOptimistic((prev) => {
        const next = { ...prev };
        ids.forEach((id) => delete next[id]);
        return next;
      });
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Approval failed.";
      toast.error(message);
    }
  };

  const statusOf = (r: TimeEntry) => (optimistic[r.id] ? "approved" : r.displayStatus);

  const exportCsv = () => {
    const header = ["Staff", "Role", "Branch", "Date", "In", "Out", "Break", "Total", "Status"];
    const body = rows.map((r) => [
      r.staffName,
      r.staffRole,
      r.branchName ?? "",
      formatDayLabel(r.clock_in_at),
      formatClock(r.clock_in_at),
      r.clock_out_at ? formatClock(r.clock_out_at) : "running",
      r.break_minutes ? `${r.break_minutes}m` : "—",
      formatDuration(r.workedMinutes),
      STATUS_TEXT[statusOf(r)],
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheets-${period.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scopeLabel = branchId === null ? "all branches" : branchName;
  const selCount = selectedVisible.length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-[10px]">
        <Segmented
          options={PERIOD_LABELS.map((p) => ({ key: p, label: p }))}
          value={period}
          onChange={setPeriod}
          className="bg-white"
        />
        <Segmented
          options={STATUS_LABELS.map((s) => ({ key: s, label: s }))}
          value={status}
          onChange={setStatus}
          className="bg-white"
        />
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={exportCsv} className={BTN_SECONDARY}>
            <Download className="h-[15px] w-[15px] text-[#64748b]" strokeWidth={2.2} />
            Export CSV
          </button>
          {canApprove && (
            <button
              type="button"
              disabled={selCount === 0}
              onClick={() => approve(selectedVisible)}
              className={cn(
                "flex items-center gap-[7px] rounded-[9px] px-[14px] py-[9px] text-[13px] font-semibold leading-none transition-colors",
                selCount
                  ? "cursor-pointer bg-[#059669] text-white shadow-[0_3px_10px_rgba(5,150,105,0.28)] hover:bg-[#047857]"
                  : "cursor-not-allowed bg-[#f1f5f9] text-[#94a3b8]"
              )}
            >
              {selCount ? `Approve ${selCount} selected` : "Approve selected"}
            </button>
          )}
        </div>
      </div>

      <div className={cn(CARD, "overflow-hidden")}>
        {/* The card clips; the body scrolls sideways so Total/Status/Actions
            stay reachable on a laptop. */}
        <div className="overflow-x-auto">
          <div
            className={cn(
              GRID,
              "items-center border-b border-[#e2e8f0] bg-[#f8fafc] py-[11px] text-[10.5px] font-bold uppercase leading-[1.2] tracking-[0.06em] text-[#64748b]"
            )}
          >
            <Checkbox checked={allOn} onClick={toggleAll} label="Select all visible entries" />
            <span>Staff</span>
            <span>Date</span>
            <span>In</span>
            <span>Out</span>
            <span>Break</span>
            <span>Total</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {rows.map((r) => {
            const st = statusOf(r);
            const on = !!selected[r.id];
            const actionable = st === "pending" || st === "late";
            const running = !r.clock_out_at && !r.auto_closed;
            const note = r.flag_reason ?? (r.auto_closed ? "Auto-closed — needs a real end time" : null);

            return (
              <div key={r.id}>
                <div
                  className={cn(
                    GRID,
                    "items-center border-b border-[#f1f5f9] py-[11px]",
                    on ? "bg-[#f6fefb]" : "bg-white"
                  )}
                >
                  <Checkbox
                    checked={on}
                    onClick={() => toggleRow(r.id)}
                    label={`Select ${r.staffName}, ${formatDayLabel(r.clock_in_at)}`}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold leading-[1.3] text-[#1e293b]">
                      {r.staffName}
                    </div>
                    <div className="text-[11px] leading-[1.3] text-[#94a3b8]">
                      {r.staffRole}
                      {r.branchName ? ` · ${r.branchName}` : ""}
                    </div>
                  </div>
                  <span className="text-[12.5px] font-medium leading-[1.3] text-[#475569]">
                    {formatDayLabel(r.clock_in_at)}
                  </span>
                  <span
                    className={cn(
                      "text-[13px] font-medium leading-[1.3]",
                      MONO,
                      st === "late" ? "text-[#b91c1c]" : "text-[#475569]"
                    )}
                  >
                    {formatClock(r.clock_in_at)}
                  </span>
                  <span
                    className={cn(
                      "text-[13px] font-medium leading-[1.3]",
                      MONO,
                      running ? "text-[#059669]" : r.auto_closed ? "text-[#b45309]" : "text-[#475569]"
                    )}
                  >
                    {running ? "running" : r.clock_out_at ? formatClock(r.clock_out_at) : "—"}
                  </span>
                  <span className="text-[12.5px] font-medium leading-[1.3] text-[#94a3b8]">
                    {r.break_minutes ? `${r.break_minutes}m` : "—"}
                  </span>
                  <span className="text-[13.5px] font-bold leading-[1.3] tabular-nums text-[#334155]">
                    {running ? "—" : formatDuration(r.workedMinutes)}
                  </span>
                  <span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-[3px] text-[10.5px] font-semibold leading-[1.6]",
                        STATUS_PILL[STATUS_TEXT[st]]
                      )}
                    >
                      {STATUS_TEXT[st]}
                    </span>
                  </span>
                  <span className="flex justify-end gap-1.5">
                    {actionable && canApprove && (
                      <>
                        <button type="button" onClick={() => approve([r.id])} className={BTN_APPROVE}>
                          Approve
                        </button>
                        <button type="button" onClick={() => setEditing(r)} className={BTN_EDIT}>
                          Edit
                        </button>
                      </>
                    )}
                    {st === "approved" && r.approvedByName && (
                      <span className="truncate text-[11.5px] font-medium leading-[1.3] text-[#94a3b8]">
                        {r.approvedByName}
                        {r.approved_at ? ` · ${formatDayLabel(r.approved_at)}` : ""}
                      </span>
                    )}
                  </span>
                </div>

                {note && (
                  <div className="flex min-w-[980px] items-center gap-2 border-b border-[#f1f5f9] bg-[#fffbeb] py-2 pr-[18px] pb-[10px] pl-[62px] text-[12px] font-medium leading-[1.4] text-[#92400e]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#b45309]" strokeWidth={2.2} />
                    {note}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && rows.length === 0 && (
            <div className="min-w-[980px] px-[18px] py-10 text-center text-[12.5px] text-[#94a3b8]">
              No entries match {period.toLowerCase()} · {scopeLabel} · {status.toLowerCase()}.
            </div>
          )}
          {loading && (
            <div className="min-w-[980px] px-[18px] py-10 text-center text-[12.5px] text-[#94a3b8]">
              Loading entries…
            </div>
          )}
        </div>

        <div className="flex items-center justify-between bg-[#f8fafc] px-[18px] py-[13px]">
          <span className="text-[12.5px] font-semibold leading-[1.3] text-[#64748b]">
            {rows.length} entries · {scopeLabel}
          </span>
          <span className="text-[17px] font-extrabold leading-[1.2] tabular-nums text-[#059669]">
            {formatDuration(totalMinutes)}
          </span>
        </div>
      </div>

      {editing && (
        <EditDialog entry={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
    </>
  );
}
