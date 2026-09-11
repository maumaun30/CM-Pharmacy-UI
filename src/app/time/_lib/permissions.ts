// app/time/_lib/permissions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Capability gate for the Time console.
//
// The API's permission matrix (config/permissions.js) now ships the `time.*`
// keys and /auth/me expands them onto the user, so this is a thin typed wrapper
// over the shared can() helper — no local role table. Components call canTime()
// so access tracks the capability, never a role string.
// ─────────────────────────────────────────────────────────────────────────────

import { can } from "@/lib/permissions";
import type { AuthUser } from "@/context/AuthContext";

export type TimePermission =
  | "time.clock" // clock self in/out (mobile)
  | "time.view_own" // see own timesheets
  | "time.view_all" // see every staff member's entries + the branch overview
  | "time.approve" // approve / edit entries
  | "time.settings" // edit clock-in and pay rules for own branch
  | "time.view_cost" // see the labour-cost figure on KPI cards
  | "time.admin"; // all branches, users & roles, integrations, audit log

export function canTime(
  user: AuthUser | null | undefined,
  permission: TimePermission
): boolean {
  return can(user, permission);
}

/** Any console access at all. Staff clock in from the phone instead. */
export function canOpenConsole(user: AuthUser | null | undefined): boolean {
  return canTime(user, "time.view_all");
}
