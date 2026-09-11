"use client";

// app/time/_components/ConsoleShell.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The console chrome: 236px sidebar + fluid main column, plus the shared state
// every page reads (branch scope, period/status filters, refresh signal).
//
// Note what is deliberately absent: the prototype's role switcher. The handoff
// README calls it "a demo affordance only — in production the role comes from
// the session", so roles here are derived from the signed-in user via canTime().
//
// Live updates: the API emits time:clock and time:entry-updated to the branch
// room. Rather than each page opening its own socket, the shell listens once
// and bumps `refreshToken`; pages refetch when it changes.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSocketEvent } from "@/context/SocketContext";
import { cn, getFullName } from "@/lib/utils";
import { canTime } from "../_lib/permissions";
import { useNow, wallClock } from "../_lib/useNow";
import {
  getOverview,
  PERIOD_LABELS,
  STATUS_LABELS,
  type PeriodLabel,
  type StatusLabel,
} from "@/lib/time";

export interface BranchOption {
  id: number | null; // null = every branch (admin only)
  name: string;
}

interface ConsoleState {
  isAdmin: boolean;
  showCost: boolean;
  canApprove: boolean;
  canEditSettings: boolean;
  /** null = all branches. */
  branchId: number | null;
  setBranchId: (id: number | null) => void;
  branchName: string;
  branches: BranchOption[];
  period: PeriodLabel;
  setPeriod: (p: PeriodLabel) => void;
  status: StatusLabel;
  setStatus: (s: StatusLabel) => void;
  /** Bumped by socket events and by mutations; pages refetch on change. */
  refreshToken: number;
  refresh: () => void;
  /** Published by the Timesheets page so the header subtitle can quote it. */
  entryCount: number | null;
  setEntryCount: (n: number | null) => void;
  now: number | null;
}

const ConsoleContext = createContext<ConsoleState | null>(null);

export function useConsole(): ConsoleState {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used inside ConsoleShell");
  return ctx;
}

const NAV = [
  { href: "/time", label: "Overview" },
  { href: "/time/timesheets", label: "Timesheets" },
  { href: "/time/settings", label: "Settings" },
];

const ADMIN_NAV = [{ href: "/time/audit", label: "Audit log" }];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Thu 11 Sep", or a neutral label before the first client tick. */
function todayLabel(now: number | null): string {
  if (now === null) return "Today";
  return new Date(now).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function NavButton({
  href,
  label,
  count,
  active,
  className,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-[10px] rounded-[9px] px-[10px] py-[9px] text-left text-[13.5px] font-semibold leading-none whitespace-nowrap transition-colors",
        className,
        active ? "bg-[#ecfdf5] text-[#047857]" : "text-[#475569] hover:bg-[#f8fafc]"
      )}
    >
      <span
        className={cn(
          "h-[7px] w-[7px] shrink-0 rounded-full",
          active ? "bg-[#059669]" : "bg-[#cbd5e1]"
        )}
      />
      {label}
      {!!count && !active && (
        <span className="ml-auto rounded-md bg-[#fef3c7] px-[6px] py-px text-[10.5px] font-bold leading-[1.6] text-[#b45309]">
          {count}
        </span>
      )}
    </Link>
  );
}

function Segmented<T extends string | number | null>({
  options,
  value,
  onChange,
  className,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-[5px] rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-1",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={String(opt.key)}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "cursor-pointer rounded-[7px] px-[14px] py-[7px] text-[12.5px] font-semibold leading-none whitespace-nowrap transition-colors",
            // The console's selected pill is white with a lift — unlike the
            // mobile app, which fills it emerald-50.
            opt.key === value
              ? "bg-white text-[#047857] shadow-[0_1px_2px_rgba(15,23,42,0.12)]"
              : "bg-transparent text-[#64748b] hover:text-[#334155]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export { Segmented };

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const now = useNow();

  const isAdmin = canTime(user, "time.admin");
  const showCost = canTime(user, "time.view_cost");
  const canApprove = canTime(user, "time.approve");
  const canEditSettings = canTime(user, "time.settings");

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState<number | null>(
    isAdmin ? null : (user?.current_branch_id ?? user?.branch_id ?? null)
  );
  const [period, setPeriod] = useState<PeriodLabel>(PERIOD_LABELS[0]);
  const [status, setStatus] = useState<StatusLabel>(STATUS_LABELS[0]);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [onShiftNote, setOnShiftNote] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  // Both socket events mean "some page's data is now stale".
  useSocketEvent("time:clock", refresh);
  useSocketEvent("time:entry-updated", refresh);

  // Branch scope options. An admin may cross branches, so they get the full
  // list plus "All branches"; a manager is limited to the branches granted on
  // their own user row — the API re-checks this regardless of what we send.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      if (isAdmin) {
        try {
          const res = await api.get("/branches");
          const rows = (res.data as { id: number; name: string }[]) ?? [];
          if (!cancelled) {
            setBranches([
              { id: null, name: "All branches" },
              ...rows.map((b) => ({ id: b.id, name: b.name })),
            ]);
          }
        } catch {
          if (!cancelled) setBranches([{ id: null, name: "All branches" }]);
        }
        return;
      }

      const allowed = user?.allowed_branches?.length
        ? user.allowed_branches.map((b) => ({ id: b.id, name: b.name }))
        : user?.branch
          ? [{ id: user.branch.id, name: user.branch.name }]
          : [];
      if (!cancelled) setBranches(allowed);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

  // The sidebar badge and live footer come from the same overview call the
  // Overview page uses; it is cheap and keeps the count honest after approvals.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getOverview(branchId)
      .then((data) => {
        if (cancelled) return;
        setPendingCount(data.kpis.pending_approvals);
        setOnShiftNote(`${data.kpis.on_shift_now} of ${data.kpis.rostered_today} on shift`);
      })
      .catch(() => {
        if (cancelled) return;
        setPendingCount(0);
        setOnShiftNote(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user, branchId, refreshToken]);

  const branchName = useMemo(() => {
    if (branchId === null) return "All branches";
    return branches.find((b) => b.id === branchId)?.name ?? "";
  }, [branchId, branches]);

  const value = useMemo<ConsoleState>(
    () => ({
      isAdmin,
      showCost,
      canApprove,
      canEditSettings,
      branchId,
      setBranchId,
      branchName,
      branches,
      period,
      setPeriod,
      status,
      setStatus,
      refreshToken,
      refresh,
      entryCount,
      setEntryCount,
      now,
    }),
    [
      isAdmin,
      showCost,
      canApprove,
      canEditSettings,
      branchId,
      branchName,
      branches,
      period,
      status,
      refreshToken,
      refresh,
      entryCount,
      now,
    ]
  );

  const scopeLabel = branchId === null ? "all branches" : branchName;
  const dateLabel = todayLabel(now);

  const { title, subtitle } = useMemo(() => {
    if (pathname === "/time/timesheets") {
      return {
        title: "Timesheets",
        subtitle: `${period} · ${scopeLabel} · ${entryCount ?? 0} entries`,
      };
    }
    if (pathname === "/time/settings") {
      return { title: "Settings", subtitle: "Clock-in rules, pay rules and access" };
    }
    if (pathname === "/time/audit") {
      return { title: "Audit log", subtitle: "Every change, who made it and from where" };
    }
    return { title: "Branch overview", subtitle: `${dateLabel} · ${scopeLabel} · live` };
  }, [pathname, period, scopeLabel, entryCount, dateLabel]);

  const fullName = getFullName(user) || user?.username || "";
  const initials = initialsOf(fullName);

  const navItems = NAV.map((item) => ({
    ...item,
    count: item.href === "/time/timesheets" ? pendingCount : undefined,
    active: pathname === item.href,
  }));

  return (
    <ConsoleContext.Provider value={value}>
      <div className="grid min-h-screen grid-cols-1 bg-[#f8fafc] lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#e2e8f0] bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-1 lg:px-[14px] lg:pt-5 lg:pb-[84px]">
          <div className="flex items-center gap-[9px] px-2 pb-[18px]">
            <Image src="/logo-icon.png" alt="" width={30} height={30} className="h-[30px] w-auto" />
            <div className="flex min-w-0 flex-col">
              <span className="text-[13.5px] font-bold leading-[1.2] text-[#1e293b]">
                {process.env.NEXT_PUBLIC_SITE_NAME || "CM Pharmacy"}
              </span>
              <span className="text-[11px] font-medium leading-[1.3] text-[#64748b]">
                Time console
              </span>
            </div>
          </div>

          <span className="px-2 pb-[6px] text-[10px] font-bold uppercase leading-[1.2] tracking-[0.08em] text-[#94a3b8]">
            Workspace
          </span>
          {navItems.map((item) => (
            <NavButton key={item.href} {...item} className="w-full" />
          ))}

          {isAdmin && (
            <>
              <span className="px-2 pt-[18px] pb-[6px] text-[10px] font-bold uppercase leading-[1.2] tracking-[0.08em] text-[#94a3b8]">
                Administration
              </span>
              {ADMIN_NAV.map((item) => (
                <NavButton
                  key={item.href}
                  {...item}
                  active={pathname === item.href}
                  className="w-full"
                />
              ))}
            </>
          )}

          <div className="mt-auto rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-[10px] py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#059669] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#059669]" />
              </span>
              <span className="text-[11.5px] font-semibold leading-[1.3] text-[#334155]">
                Live · {wallClock(now)}
              </span>
            </div>
            <div className="mt-[3px] text-[11px] leading-[1.4] text-[#64748b]">
              {onShiftNote ? `${onShiftNote} · ${scopeLabel}` : "—"}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="flex flex-wrap items-center gap-4 border-b border-[#e2e8f0] bg-white px-4 py-4 sm:px-7">
            <div className="min-w-[200px] flex-1">
              <div className="text-[22px] font-bold leading-[1.2] text-[#1e293b]">{title}</div>
              <div className="mt-0.5 text-[13px] leading-[1.3] text-[#64748b]">{subtitle}</div>
            </div>

            {branches.length > 1 && (
              <Segmented
                options={branches.map((b) => ({ key: b.id, label: b.name }))}
                value={branchId}
                onChange={setBranchId}
              />
            )}

            <div className="flex items-center gap-[10px] border-[#e2e8f0] sm:border-l sm:pl-4">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#059669] text-[13px] font-bold leading-none text-white">
                {initials}
              </div>
            </div>
          </header>

          {/* Sidebar nav collapses to a scrollable strip on narrow screens. */}
          <div className="flex gap-2 overflow-x-auto border-b border-[#e2e8f0] bg-white px-4 py-2 lg:hidden">
            {[
              ...navItems,
              ...(isAdmin
                ? ADMIN_NAV.map((i) => ({ ...i, count: undefined, active: pathname === i.href }))
                : []),
            ].map((item) => (
              <NavButton key={item.href} {...item} />
            ))}
          </div>

          {/* pb clears the app's fixed bottom Navbar. */}
          <div className="flex flex-1 flex-col gap-[18px] px-4 pt-6 pb-[120px] sm:px-7">
            {children}
          </div>
        </main>
      </div>
    </ConsoleContext.Provider>
  );
}
