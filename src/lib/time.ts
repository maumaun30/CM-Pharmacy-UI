import api from "@/lib/api";

// ── Time tracking API client ─────────────────────────────────────────────────
// Mirrors CM-Pharmacy-API/controllers/timeController.js. Raw columns come back
// snake_case; derived and joined values are camelCase (the workspace's casing
// rule — see the API's docs/local-dev.md).

export type EntryStatus = "approved" | "pending" | "late" | "open";
export type AuditSource = "Console" | "Mobile" | "Automation";

export interface TimeEntry {
  id: number;
  user_id: number;
  branch_id: number;
  clock_in_at: string;
  clock_out_at: string | null;
  break_minutes: number;
  break_started_at: string | null;
  status: "open" | "pending" | "approved";
  source: "mobile" | "console" | "automation";
  verified: boolean;
  flag_reason: string | null;
  auto_closed: boolean;
  approved_at: string | null;
  edit_reason: string | null;
  note: string | null;
  // Derived server-side.
  workedMinutes: number;
  displayStatus: EntryStatus;
  lateMinutes: number | null;
  scheduledStart: string | null;
  edited: boolean;
  staffName: string;
  staffRole: string;
  branchName: string | null;
  approvedByName: string | null;
}

export interface OnShiftPerson {
  entry_id: number;
  user_id: number;
  branch_id: number;
  clock_in_at: string;
  name: string;
  role: string;
  branchName: string | null;
  workedMinutes: number;
  onBreak: boolean;
  lateMinutes: number | null;
  verified: boolean;
}

export interface OverviewKpis {
  on_shift_now: number;
  rostered_today: number;
  week_minutes: number;
  /** Null when no hourly rate is configured — show a head count instead. */
  labour_cost: number | null;
  pending_approvals: number;
  overtime_minutes: number;
  exceptions: number;
}

export interface ChartDay {
  date: string;
  dow: string;
  minutes: number;
  hours: number;
  isToday: boolean;
}

export interface AttentionItem {
  kind: "late" | "missed-clock-out" | "off-network";
  title: string;
  detail: string;
}

export interface CoverageGap {
  branch_id: number;
  branchName: string | null;
  when: string;
  need: string;
  severity: "danger" | "warning";
  pill: "Unstaffed" | "Short";
}

export interface Overview {
  kpis: OverviewKpis;
  week_chart: ChartDay[];
  attention: AttentionItem[];
  coverage_gaps: CoverageGap[];
  branch_id: number | null;
}

export interface ClockRules {
  branch_id: number;
  wifi_lock: boolean;
  geo_lock: boolean;
  geo_radius_m: number;
  latitude: number | null;
  longitude: number | null;
  auto_clock_out: boolean;
  auto_clock_out_at: string;
  late_grace_minutes: number;
}

export interface PayRules {
  branch_id: number;
  normal_week_hours: number;
  overtime_multiplier: number;
  holiday_multiplier: number;
  unpaid_break_minutes: number;
  pay_period_day: number;
  hourly_rate: number | null;
}

export interface AccessPoint {
  id: number;
  branch_id: number;
  ssid: string;
  bssid: string;
  label: string | null;
  is_allowed: boolean;
  branchName: string | null;
}

export interface TimeSettings {
  branch_id: number;
  clock_rules: ClockRules | null;
  pay_rules: PayRules | null;
  access_points: AccessPoint[];
}

export interface AuditEntry {
  id: number;
  when: string;
  who: string;
  action: string;
  module: string;
  record_id: number | null;
  text: string | null;
  source: AuditSource;
}

// ── Filter labels ────────────────────────────────────────────────────────────
// The console shows human labels; the API takes slugs.

export const PERIOD_LABELS = ["This week", "Last week", "Pay period"] as const;
export const STATUS_LABELS = ["All", "Needs action", "Approved"] as const;
export type PeriodLabel = (typeof PERIOD_LABELS)[number];
export type StatusLabel = (typeof STATUS_LABELS)[number];

const PERIOD_SLUG: Record<PeriodLabel, string> = {
  "This week": "this-week",
  "Last week": "last-week",
  "Pay period": "pay-period",
};

const STATUS_SLUG: Record<StatusLabel, string> = {
  All: "all",
  "Needs action": "needs-action",
  Approved: "approved",
};

// ── Calls ────────────────────────────────────────────────────────────────────

export async function getOverview(branchId?: number | null) {
  const res = await api.get("/time/overview", { params: { branchId: branchId ?? undefined } });
  return res.data as Overview;
}

export async function getOnShift(branchId?: number | null) {
  const res = await api.get("/time/on-shift", { params: { branchId: branchId ?? undefined } });
  return res.data as { people: OnShiftPerson[]; on_shift: number; rostered_today: number };
}

export async function listEntries(params: {
  period: PeriodLabel;
  status: StatusLabel;
  branchId?: number | null;
}) {
  const res = await api.get("/time/entries", {
    params: {
      period: PERIOD_SLUG[params.period],
      status: STATUS_SLUG[params.status],
      branchId: params.branchId ?? undefined,
    },
  });
  return res.data as {
    entries: TimeEntry[];
    total_minutes: number;
    count: number;
    branch_id: number | null;
  };
}

export async function approveEntries(ids: number[]) {
  const res = await api.post("/time/entries/approve", { ids });
  return res.data as { entries: TimeEntry[]; approved: number };
}

export async function updateEntry(
  id: number,
  payload: { clockInAt?: string; clockOutAt?: string | null; breakMinutes?: number; reason: string }
) {
  const res = await api.put(`/time/entries/${id}`, payload);
  return res.data as { entry: TimeEntry };
}

export async function getTimeSettings(branchId?: number | null) {
  const res = await api.get("/time/settings", { params: { branchId: branchId ?? undefined } });
  return res.data as TimeSettings;
}

export async function updateClockRules(
  payload: Partial<{
    wifiLock: boolean;
    geoLock: boolean;
    geoRadiusM: number;
    latitude: number | null;
    longitude: number | null;
    autoClockOut: boolean;
    autoClockOutAt: string;
    lateGraceMinutes: number;
  }>,
  branchId?: number | null
) {
  const res = await api.put("/time/settings/rules", payload, {
    params: { branchId: branchId ?? undefined },
  });
  return res.data;
}

export async function updatePayRules(
  payload: Partial<{
    normalWeekHours: number;
    overtimeMultiplier: number;
    holidayMultiplier: number;
    unpaidBreakMinutes: number;
    payPeriodDay: number;
    hourlyRate: number | null;
  }>,
  branchId?: number | null
) {
  const res = await api.put("/time/settings/pay-rules", payload, {
    params: { branchId: branchId ?? undefined },
  });
  return res.data;
}

export async function addAccessPoint(
  payload: { ssid: string; bssid: string; label?: string; isAllowed?: boolean },
  branchId?: number | null
) {
  const res = await api.post("/time/settings/access-points", payload, {
    params: { branchId: branchId ?? undefined },
  });
  return res.data as { access_point: AccessPoint };
}

export async function deleteAccessPoint(id: number) {
  const res = await api.delete(`/time/settings/access-points/${id}`);
  return res.data as { message: string };
}

export async function getAudit(limit = 50) {
  const res = await api.get("/time/audit", { params: { limit } });
  return res.data as { entries: AuditEntry[] };
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** Minutes → "8h 25m", the console's total format. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Minutes → "6:04", the live elapsed format on the on-shift list. */
export function formatElapsed(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  return `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;
}

/** Postgres timestamptz ("2026-09-11 06:53:30.19+00") → a Date Safari accepts. */
export function parseApiDate(value: string | null): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatClock(value: string | null): string {
  const d = parseApiDate(value);
  if (!d) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDayLabel(value: string | null): string {
  const d = parseApiDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export const STATUS_TEXT: Record<EntryStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  late: "Late",
  open: "Open",
};
