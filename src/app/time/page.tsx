"use client";

// app/time/page.tsx — Overview
// KPI row, live on-shift list, exceptions, hours chart, coverage gaps, and
// (admin only) recent audit activity. One /time/overview call feeds most of it;
// the on-shift list is its own call so it can refresh on socket traffic alone.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConsole } from "./_components/ConsoleShell";
import {
  formatElapsed,
  getAudit,
  getOnShift,
  getOverview,
  type AuditEntry,
  type OnShiftPerson,
  type Overview,
} from "@/lib/time";
import {
  BTN_REVIEW,
  CARD,
  CHART_BAR,
  CHART_LABEL,
  DOT_TONE,
  GAP_BAR,
  GAP_PILL,
  KPI_TONE,
  MONO,
  SECTION_HEADER,
} from "./_lib/tokens";

/** Peso, no decimals — matches the rest of the workspace. */
const peso = (value: number) =>
  `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

const hours = (minutes: number) => `${Math.round(minutes / 60)}h`;

/** Bars are bottom-aligned in a 170px body; scale to the busiest day. */
function barHeight(minutes: number, max: number): number {
  if (max <= 0) return 6;
  return Math.max(6, Math.round((minutes / max) * 120));
}

export default function OverviewPage() {
  const { isAdmin, showCost, branchId, branchName, setStatus, refreshToken, now } = useConsole();
  const router = useRouter();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [people, setPeople] = useState<OnShiftPerson[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [ov, shift] = await Promise.all([getOverview(branchId), getOnShift(branchId)]);
      setOverview(ov);
      setPeople(shift.people);
      if (isAdmin) {
        const { entries } = await getAudit(4);
        setAudit(entries);
      }
    } catch {
      setError("Could not load the branch overview.");
    } finally {
      setLoading(false);
    }
  }, [branchId, isAdmin]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  if (loading) {
    return <div className="py-16 text-center text-[13px] text-[#94a3b8]">Loading overview…</div>;
  }

  if (error || !overview) {
    return (
      <div className={cn(CARD, "px-[18px] py-10 text-center text-[13px] text-[#b91c1c]")}>
        {error ?? "No data"}
      </div>
    );
  }

  const k = overview.kpis;
  const maxMinutes = Math.max(...overview.week_chart.map((d) => d.minutes), 0);

  const kpis = [
    {
      label: "On shift now",
      value: String(k.on_shift_now),
      sub: `of ${k.rostered_today} rostered today`,
      tone: "emerald" as const,
    },
    {
      label: "Hours this week",
      value: hours(k.week_minutes),
      // Without an hourly rate configured the API returns null rather than a
      // misleading zero, so fall back to the head count the prototype showed.
      sub:
        showCost && k.labour_cost !== null
          ? `${peso(k.labour_cost)} labour`
          : `${people.length} on shift`,
      tone: "slate" as const,
    },
    {
      label: "Pending approvals",
      value: String(k.pending_approvals),
      sub: k.pending_approvals ? "awaiting review" : "all clear",
      tone: "amber" as const,
    },
    isAdmin
      ? {
          label: "Exceptions",
          value: String(k.exceptions),
          sub: "late, missed, off-network",
          tone: "red" as const,
        }
      : {
          label: "Overtime",
          value: hours(k.overtime_minutes),
          sub: "beyond the normal week",
          tone: "amber" as const,
        },
  ];

  // "Review" jumps to Timesheets pre-filtered to the rows needing a decision.
  const review = () => {
    setStatus("Needs action");
    router.push("/time/timesheets");
  };

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[14px]">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn(CARD, "px-[18px] py-4")}>
            <div className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.06em] text-[#64748b]">
              {kpi.label}
            </div>
            <div
              className={cn(
                "mt-1.5 text-[30px] font-extrabold leading-[1.15] tabular-nums",
                KPI_TONE[kpi.tone]
              )}
            >
              {kpi.value}
            </div>
            <div className="mt-[3px] text-[12px] leading-[1.4] text-[#64748b]">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-[18px]">
        <div className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-[18px] py-[10px]">
            <span className="text-[11px] font-bold uppercase leading-[1.2] tracking-[0.06em] text-[#047857]">
              On shift now
            </span>
            <span className="text-[11.5px] font-semibold leading-[1.2] text-[#64748b]">
              {k.on_shift_now} of {k.rostered_today}
            </span>
          </div>
          {people.map((p) => {
            // Recomputed client-side from the clock-in so the timer ticks
            // between refetches instead of freezing on the server's snapshot.
            const elapsed = now
              ? Math.max(0, Math.round((now - new Date(p.clock_in_at.replace(" ", "T")).getTime()) / 60000))
              : p.workedMinutes;
            return (
              <div
                key={p.entry_id}
                className="flex items-center gap-3 border-b border-[#f1f5f9] px-[18px] py-[11px] last:border-b-0"
              >
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#ecfdf5] text-[12px] font-bold leading-none text-[#047857]">
                  {p.name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold leading-[1.3] text-[#1e293b]">
                    {p.name}
                  </div>
                  <div className="text-[11.5px] leading-[1.3] text-[#64748b]">
                    {p.role}
                    {p.branchName ? ` · ${p.branchName}` : ""} ·{" "}
                    {new Date(p.clock_in_at.replace(" ", "T")).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn("text-[13px] font-bold leading-[1.2] text-[#334155]", MONO)}>
                    {formatElapsed(elapsed)}
                  </div>
                  <div
                    className={cn(
                      "text-[10.5px] font-medium leading-[1.4]",
                      p.onBreak || p.lateMinutes ? "text-[#b45309]" : "text-[#047857]"
                    )}
                  >
                    {p.onBreak
                      ? "On break"
                      : p.lateMinutes
                        ? `${p.lateMinutes}m late`
                        : "On time"}
                  </div>
                </div>
              </div>
            );
          })}
          {people.length === 0 && (
            <div className="px-[18px] py-6 text-center text-[12.5px] text-[#94a3b8]">
              Nobody is clocked in at {branchId === null ? "any branch" : branchName}.
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          {overview.attention.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#fde68a] bg-[#fffbeb] shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2 px-[18px] pt-[13px] pb-[11px]">
                <AlertTriangle className="h-[17px] w-[17px] text-[#b45309]" strokeWidth={2.2} />
                <span className="text-[13px] font-bold leading-[1.2] text-[#92400e]">
                  Needs attention
                </span>
              </div>
              {overview.attention.map((a) => (
                <div
                  key={a.kind}
                  className="flex items-center gap-3 border-t border-[#fef3c7] px-[18px] py-[10px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-[1.3] text-[#1e293b]">
                      {a.title}
                    </div>
                    <div className="text-[12px] leading-[1.4] text-[#a16207]">{a.detail}</div>
                  </div>
                  <button type="button" onClick={review} className={BTN_REVIEW}>
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={cn(CARD, "overflow-hidden")}>
            <div className={SECTION_HEADER}>Hours this week</div>
            <div className="flex h-[170px] items-end gap-[10px] px-[18px] pt-[18px] pb-[10px]">
              {overview.week_chart.map((d) => {
                const kind = d.minutes === 0 ? "closed" : d.isToday ? "today" : "worked";
                return (
                  <div
                    key={d.date}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-[7px]"
                  >
                    <span className="text-[10.5px] font-semibold leading-none text-[#94a3b8]">
                      {d.minutes === 0 ? "—" : d.hours}
                    </span>
                    <div
                      className={cn("w-full rounded-md", CHART_BAR[kind])}
                      style={{ height: barHeight(d.minutes, maxMinutes) }}
                    />
                    <span
                      className={cn("text-[11px] font-semibold leading-none", CHART_LABEL[kind])}
                    >
                      {d.dow}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 px-[18px] pb-[14px] text-[11.5px] leading-[1.3] text-[#64748b]">
              <span className="flex items-center gap-1.5">
                <span className="h-[9px] w-[9px] rounded-[3px] bg-[#059669]" />
                Worked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[9px] w-[9px] rounded-[3px] bg-[#34d399]" />
                Today
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[9px] w-[9px] rounded-[3px] bg-[#e2e8f0]" />
                Closed
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-[18px]">
        <div className={cn(CARD, "overflow-hidden")}>
          <div className={SECTION_HEADER}>Coverage gaps</div>
          {overview.coverage_gaps.map((g, i) => (
            <div
              key={`${g.when}-${i}`}
              className="flex items-center gap-3 border-b border-[#f1f5f9] px-[18px] py-3 last:border-b-0"
            >
              <span
                className={cn("w-1 shrink-0 self-stretch rounded-sm", GAP_BAR[g.severity])}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold leading-[1.3] text-[#1e293b]">
                  {g.when}
                </div>
                <div className="text-[12px] leading-[1.4] text-[#64748b]">{g.need}</div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-[3px] text-[10.5px] font-semibold leading-[1.6]",
                  GAP_PILL[g.severity]
                )}
              >
                {g.pill}
              </span>
            </div>
          ))}
          {overview.coverage_gaps.length === 0 && (
            <div className="px-[18px] py-6 text-center text-[12.5px] text-[#94a3b8]">
              No gaps in the next 7 days. Coverage needs are set per branch in the database.
            </div>
          )}
        </div>

        {isAdmin && (
          <div className={cn(CARD, "overflow-hidden")}>
            <div className={SECTION_HEADER}>Recent audit activity</div>
            {audit.map((l) => (
              <div
                key={l.id}
                className="flex gap-[11px] border-b border-[#f1f5f9] px-[18px] py-[11px] last:border-b-0"
              >
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    DOT_TONE[l.source === "Automation" ? "warn" : l.source === "Mobile" ? "ok" : "neutral"]
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium leading-[1.45] text-[#334155]">
                    {l.who} · {l.text}
                  </div>
                  <div className="text-[11px] leading-[1.3] text-[#94a3b8]">
                    {new Date(l.when.replace(" ", "T")).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
            {audit.length === 0 && (
              <div className="px-[18px] py-6 text-center text-[12.5px] text-[#94a3b8]">
                Nothing recorded yet.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
