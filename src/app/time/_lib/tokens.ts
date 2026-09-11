// app/time/_lib/tokens.ts
// ─────────────────────────────────────────────────────────────────────────────
// Design tokens for the Time console, taken verbatim from the handoff README
// ("refined emerald", the mobile app's src/ui/theme.ts).
//
// These are LITERAL Tailwind arbitrary-value classes on purpose. Two reasons:
//   1. Tailwind v4's stock palette is OKLCH — its `emerald-600` resolves to
//      #009966, not the #059669 this design specifies. Arbitrary hex keeps the
//      console pixel-accurate against the prototype.
//   2. Tailwind scans source text for class candidates, so a class assembled at
//      runtime (`bg-[${hex}]`) would never be generated. Every entry below is a
//      complete, greppable class string.
// ─────────────────────────────────────────────────────────────────────────────

/** Card surface: white, slate-200 hairline, radius 16, shadow.card. */
export const CARD =
  "rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.05)]";

/** Uppercase section header strip that caps most cards. */
export const SECTION_HEADER =
  "border-b border-[#e2e8f0] bg-[#f8fafc] px-[18px] py-[10px] text-[11px] font-bold uppercase leading-[1.2] tracking-[0.06em] text-[#047857]";

/** Status pill colours, keyed by entry status. */
export const STATUS_PILL: Record<string, string> = {
  Approved: "bg-[#d1fae5] text-[#047857]",
  Pending: "bg-[#fef3c7] text-[#b45309]",
  Late: "bg-[#fee2e2] text-[#b91c1c]",
  Open: "bg-[#f1f5f9] text-[#475569]",
};

/** Audit "Source" pill: Console neutral, Mobile success, Automation warning. */
export const SOURCE_PILL: Record<string, string> = {
  Console: "bg-[#f1f5f9] text-[#475569]",
  Mobile: "bg-[#d1fae5] text-[#047857]",
  Automation: "bg-[#fef3c7] text-[#b45309]",
};

/** Coverage-gap chrome: the 4px leading bar and its pill share a severity. */
export const GAP_BAR: Record<string, string> = {
  danger: "bg-[#b91c1c]",
  warning: "bg-[#b45309]",
};

export const GAP_PILL: Record<string, string> = {
  danger: "bg-[#fee2e2] text-[#b91c1c]",
  warning: "bg-[#fef3c7] text-[#b45309]",
};

/** KPI value colours. */
export const KPI_TONE: Record<string, string> = {
  emerald: "text-[#059669]",
  slate: "text-[#334155]",
  amber: "text-[#b45309]",
  red: "text-[#b91c1c]",
};

/** Week-chart bars: emerald normal, emerald-500 today, amber overtime, slate closed. */
export const CHART_BAR: Record<string, string> = {
  worked: "bg-[#059669]",
  today: "bg-[#34d399]",
  overtime: "bg-[#fcd34d]",
  closed: "bg-[#e2e8f0]",
};

export const CHART_LABEL: Record<string, string> = {
  worked: "text-[#334155]",
  today: "text-[#047857]",
  overtime: "text-[#334155]",
  closed: "text-[#94a3b8]",
};

/** Status-dot colours for the recent-audit feed and integration rows. */
export const DOT_TONE: Record<string, string> = {
  ok: "bg-[#059669]",
  warn: "bg-[#b45309]",
  neutral: "bg-[#94a3b8]",
  off: "bg-[#cbd5e1]",
};

/** Buttons shared across pages. */
export const BTN_SECONDARY =
  "flex items-center gap-[7px] rounded-[9px] border border-[#e2e8f0] bg-white px-[14px] py-[9px] text-[13px] font-semibold leading-none text-[#475569] transition-colors hover:bg-[#f8fafc] cursor-pointer";

export const BTN_APPROVE =
  "rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] px-[11px] py-[6px] text-[12px] font-semibold leading-none text-[#047857] transition-colors hover:bg-[#d1fae5] cursor-pointer";

export const BTN_EDIT =
  "rounded-lg border border-[#e2e8f0] bg-white px-[11px] py-[6px] text-[12px] font-semibold leading-none text-[#475569] transition-colors hover:bg-[#f8fafc] cursor-pointer";

export const BTN_REVIEW =
  "shrink-0 rounded-lg border border-[#fcd34d] bg-white px-3 py-[7px] text-[12px] font-semibold leading-none text-[#92400e] transition-colors hover:bg-[#fef3c7] cursor-pointer";

/** Monospace numerics — timers, clock times, BSSIDs. */
export const MONO = "font-mono tabular-nums";
