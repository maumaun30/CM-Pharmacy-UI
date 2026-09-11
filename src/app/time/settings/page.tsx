"use client";

// app/time/settings/page.tsx
// Clock-in rules (Wi-Fi lock + approved access points, location check, auto
// clock-out) and pay rules, per branch. Switches write through immediately and
// revert if the API rejects — every change lands in the audit log.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/permissions";
import { useConsole } from "../_components/ConsoleShell";
import {
  addAccessPoint,
  deleteAccessPoint,
  getTimeSettings,
  updateClockRules,
  updatePayRules,
  type TimeSettings,
} from "@/lib/time";
import { BTN_APPROVE, BTN_EDIT, CARD, DOT_TONE, MONO, SECTION_HEADER } from "../_lib/tokens";

function Switch({
  on,
  onToggle,
  disabled,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex h-[26px] w-11 shrink-0 rounded-[13px] p-[3px] transition-colors duration-[180ms]",
        on ? "justify-end bg-[#059669]" : "justify-start bg-[#cbd5e1]",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      )}
    >
      <span className="block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.3)]" />
    </button>
  );
}

function RuleRow({
  icon,
  iconOn,
  title,
  description,
  on,
  onToggle,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  iconOn: boolean;
  title: string;
  description: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-[13px]">
      <div
        className={cn(
          "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full",
          iconOn ? "bg-[#059669]" : "bg-[#f1f5f9]"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-[1.3] text-[#1e293b]">{title}</div>
        <div className="mt-0.5 text-[12px] leading-[1.45] text-[#64748b]">{description}</div>
        {children}
      </div>
      <Switch on={on} onToggle={onToggle} disabled={disabled} label={title} />
    </div>
  );
}

const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

interface DirectoryUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  first_name: string;
  last_name: string;
  branch_id: number;
  is_active: boolean;
}

export default function TimeSettingsPage() {
  const { branchId, branchName, canEditSettings, isAdmin, refresh, refreshToken } = useConsole();

  const [settings, setSettings] = useState<TimeSettings | null>(null);
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ssid: "", bssid: "" });

  const load = useCallback(async () => {
    try {
      setSettings(await getTimeSettings(branchId));
    } catch {
      toast.error("Could not load time settings.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  // Who can clock in, from the shared user directory — the console does not
  // keep its own. Managing accounts stays on /users; this is a read-only view.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api
      .get("/users")
      .then((res) => {
        if (!cancelled) setPeople((res.data as DirectoryUser[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const rules = settings?.clock_rules;
  const pay = settings?.pay_rules;

  // Write-through with rollback: flip locally, persist, restore on failure.
  const toggleRule = async (key: "wifiLock" | "geoLock" | "autoClockOut", next: boolean) => {
    if (!rules) return;
    const field = key === "wifiLock" ? "wifi_lock" : key === "geoLock" ? "geo_lock" : "auto_clock_out";
    setSettings((prev) =>
      prev && prev.clock_rules ? { ...prev, clock_rules: { ...prev.clock_rules, [field]: next } } : prev
    );
    try {
      await updateClockRules({ [key]: next }, branchId);
      refresh();
    } catch (err) {
      setSettings((prev) =>
        prev && prev.clock_rules
          ? { ...prev, clock_rules: { ...prev.clock_rules, [field]: !next } }
          : prev
      );
      toast.error(apiMessage(err, "Could not save that rule."));
    }
  };

  const submitAccessPoint = async () => {
    if (!form.ssid.trim() || !form.bssid.trim()) {
      toast.error("SSID and BSSID are both required");
      return;
    }
    try {
      await addAccessPoint({ ssid: form.ssid.trim(), bssid: form.bssid.trim() }, branchId);
      toast.success("Access point added");
      setForm({ ssid: "", bssid: "" });
      setAdding(false);
      load();
    } catch (err) {
      toast.error(apiMessage(err, "Could not add that access point."));
    }
  };

  const removeAccessPoint = async (id: number, ssid: string) => {
    try {
      await deleteAccessPoint(id);
      toast.success(`Removed ${ssid}`);
      load();
    } catch (err) {
      toast.error(apiMessage(err, "Could not remove that access point."));
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-[13px] text-[#94a3b8]">Loading settings…</div>;
  }

  if (!rules) {
    return (
      <div className={cn(CARD, "px-[18px] py-10 text-center text-[13px] text-[#64748b]")}>
        {branchId === null
          ? "Pick a single branch to edit its clock-in rules."
          : "This branch has no clock-in rules yet."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] items-start gap-[18px]">
      <div className={cn(CARD, "overflow-hidden")}>
        <div className={SECTION_HEADER}>
          Clock-in rules · {branchName || `Branch ${rules.branch_id}`}
        </div>
        <div className="flex flex-col gap-4 p-[18px]">
          <RuleRow
            icon={<Wifi className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />}
            iconOn={rules.wifi_lock}
            title="Wi-Fi network lock"
            description="Staff can only clock in while connected to an approved access point. Checked again server-side."
            on={rules.wifi_lock}
            onToggle={() => toggleRule("wifiLock", !rules.wifi_lock)}
            disabled={!canEditSettings}
          >
            {/* Multiple BSSIDs per branch on purpose: a router swap or a second
                AP must not lock the whole branch out. */}
            <div className="mt-[9px] overflow-hidden rounded-[10px] border border-[#e2e8f0]">
              {settings?.access_points.map((ap) => (
                <div
                  key={ap.id}
                  className="flex items-center gap-[10px] border-b border-[#f1f5f9] bg-[#f8fafc] px-[11px] py-[9px]"
                >
                  <span
                    className={cn(
                      "h-[7px] w-[7px] shrink-0 rounded-full",
                      ap.is_allowed ? DOT_TONE.ok : DOT_TONE.off
                    )}
                  />
                  <span className="flex-1 truncate text-[12.5px] font-semibold leading-[1.3] text-[#334155]">
                    {ap.ssid}
                  </span>
                  <span className={cn("text-[12px] font-medium leading-[1.3] text-[#64748b]", MONO)}>
                    {ap.bssid}
                  </span>
                  <span className="text-[11px] font-medium leading-[1.3] text-[#94a3b8]">
                    {ap.is_allowed ? (ap.branchName ?? "") : "Blocked"}
                  </span>
                  {canEditSettings && (
                    <button
                      type="button"
                      aria-label={`Remove ${ap.ssid}`}
                      onClick={() => removeAccessPoint(ap.id, ap.ssid)}
                      className="cursor-pointer text-[#94a3b8] transition-colors hover:text-[#b91c1c]"
                    >
                      <Trash2 className="h-[13px] w-[13px]" />
                    </button>
                  )}
                </div>
              ))}

              {settings?.access_points.length === 0 && (
                <div className="bg-[#fffbeb] px-[11px] py-[9px] text-[11.5px] leading-[1.4] text-[#92400e]">
                  No approved access points. With the lock on, every clock-in here is
                  flagged for review rather than blocked.
                </div>
              )}

              {adding ? (
                <div className="flex flex-wrap items-center gap-2 bg-white px-[11px] py-[9px]">
                  <input
                    value={form.ssid}
                    onChange={(e) => setForm((f) => ({ ...f, ssid: e.target.value }))}
                    placeholder="SSID"
                    className="min-w-0 flex-1 rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-[12.5px]"
                  />
                  <input
                    value={form.bssid}
                    onChange={(e) => setForm((f) => ({ ...f, bssid: e.target.value }))}
                    placeholder="A4:2B:B0:77:1E:C3"
                    className={cn(
                      "min-w-0 flex-1 rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-[12.5px]",
                      MONO
                    )}
                  />
                  <button type="button" onClick={submitAccessPoint} className={BTN_APPROVE}>
                    Save
                  </button>
                  <button type="button" onClick={() => setAdding(false)} className={BTN_EDIT}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canEditSettings || branchId === null}
                  onClick={() => setAdding(true)}
                  className="w-full cursor-pointer bg-white py-[9px] text-[12.5px] font-semibold leading-none text-[#047857] transition-colors hover:bg-[#ecfdf5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  + Add access point
                </button>
              )}
            </div>
          </RuleRow>

          <div className="h-px bg-[#f1f5f9]" />

          <RuleRow
            icon={<MapPin className="h-[18px] w-[18px] text-[#64748b]" strokeWidth={2.2} />}
            iconOn={false}
            title="Location check"
            description={`Secondary check — must be within ${rules.geo_radius_m} m of the branch. Used as a fallback on iOS, where Wi-Fi details need an entitlement.`}
            on={rules.geo_lock}
            onToggle={() => toggleRule("geoLock", !rules.geo_lock)}
            disabled={!canEditSettings}
          >
            {rules.geo_lock && rules.latitude === null && (
              <div className="mt-[9px] rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-[11px] py-[9px] text-[11.5px] leading-[1.4] text-[#92400e]">
                No coordinates set for this branch, so this check cannot be evaluated —
                clock-ins are flagged instead of measured.
              </div>
            )}
          </RuleRow>

          <div className="h-px bg-[#f1f5f9]" />

          <RuleRow
            icon={<Clock className="h-[18px] w-[18px] text-[#64748b]" strokeWidth={2.2} />}
            iconOn={false}
            title="Auto clock-out"
            description={`Close forgotten shifts at ${rules.auto_clock_out_at.slice(0, 5)} and flag them for approval instead of billing the night.`}
            on={rules.auto_clock_out}
            onToggle={() => toggleRule("autoClockOut", !rules.auto_clock_out)}
            disabled={!canEditSettings}
          />
        </div>
      </div>

      {pay && (
        <div className={cn(CARD, "overflow-hidden")}>
          <div className={SECTION_HEADER}>Pay rules</div>
          {[
            { title: "Normal week", sub: "Hours before overtime applies", value: `${pay.normal_week_hours}h` },
            { title: "Overtime rate", sub: "Beyond the normal week", value: `${pay.overtime_multiplier}×` },
            { title: "Sunday & public holidays", sub: "Premium rate", value: `${pay.holiday_multiplier}×` },
            { title: "Unpaid break", sub: "Deducted from shifts over 6h", value: `${pay.unpaid_break_minutes}m` },
            { title: "Pay period", sub: "Export cut-off", value: `${pay.pay_period_day}th` },
            {
              title: "Hourly rate",
              sub: "Drives the labour-cost figure",
              value: pay.hourly_rate === null ? "not set" : `₱${pay.hourly_rate}`,
            },
          ].map((p) => (
            <div
              key={p.title}
              className="flex items-center gap-[14px] border-b border-[#f1f5f9] px-[18px] py-[13px]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold leading-[1.3] text-[#1e293b]">
                  {p.title}
                </div>
                <div className="text-[12px] leading-[1.4] text-[#64748b]">{p.sub}</div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-[11px] py-1.5 text-[13px] font-semibold leading-none text-[#334155]",
                  MONO
                )}
              >
                {p.value}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-[18px] py-3">
            <span className="text-[11.5px] leading-[1.45] text-[#94a3b8]">
              Changing a pay rule applies from the next pay period — it never rewrites
              approved timesheets.
            </span>
            {canEditSettings && branchId !== null && (
              <button
                type="button"
                className={cn(BTN_EDIT, "shrink-0")}
                onClick={async () => {
                  const input = window.prompt(
                    "Hourly rate (₱). Leave blank to clear.",
                    pay.hourly_rate === null ? "" : String(pay.hourly_rate)
                  );
                  if (input === null) return;
                  try {
                    await updatePayRules(
                      { hourlyRate: input.trim() === "" ? null : Number(input) },
                      branchId
                    );
                    toast.success("Pay rules updated");
                    load();
                  } catch (err) {
                    toast.error(apiMessage(err, "Could not update pay rules."));
                  }
                }}
              >
                Set rate
              </button>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-[18px] py-[10px]">
            <span className="text-[11px] font-bold uppercase leading-[1.2] tracking-[0.06em] text-[#047857]">
              Users &amp; roles
            </span>
            <Link href="/users" className={BTN_APPROVE}>
              Manage users
            </Link>
          </div>
          {people.map((u) => {
            const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.username;
            const elevated = u.role === "admin" || u.role === "superadmin" || u.role === "manager";
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 border-b border-[#f1f5f9] px-[18px] py-[11px]"
              >
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[12px] font-bold leading-none text-[#475569]">
                  {name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold leading-[1.3] text-[#1e293b]">
                    {name}
                  </div>
                  <div className="truncate text-[11.5px] leading-[1.3] text-[#64748b]">
                    {u.email ?? u.username}
                    {!u.is_active && " · inactive"}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-[3px] text-[10.5px] font-semibold uppercase leading-[1.6] tracking-[0.04em]",
                    elevated ? "bg-[#d1fae5] text-[#047857]" : "bg-[#f1f5f9] text-[#475569]"
                  )}
                >
                  {roleLabel(u.role)}
                </span>
              </div>
            );
          })}
          {people.length === 0 && (
            <div className="px-[18px] py-6 text-center text-[12.5px] text-[#94a3b8]">
              No users loaded.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
