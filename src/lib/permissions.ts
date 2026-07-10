// lib/permissions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-side mirror of the API's permission model. The role→permission matrix
// itself lives ONLY on the API (config/permissions.js); the browser just reads
// the expanded `permissions` array the API attaches to the current user (via
// /auth/me) and asks `can(user, "products.write")`. Never hardcode role strings
// in components — gate on capabilities so the two stay in lockstep.
// ─────────────────────────────────────────────────────────────────────────────

import type { AuthUser } from "@/context/AuthContext";

/** Does the current user hold a given permission? Wildcards are respected. */
export function can(
  user: AuthUser | null | undefined,
  permission: string
): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  if (perms.includes("*") || perms.includes(permission)) return true;
  const resource = permission.split(".")[0];
  return perms.includes(`${resource}.*`);
}

/** True if the user holds ANY of the listed permissions. */
export function canAny(
  user: AuthUser | null | undefined,
  permissions: string[]
): boolean {
  return permissions.some((p) => can(user, p));
}

/** Human-friendly role names for display. */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  manager: "Manager",
  cashier: "Cashier",
};

/** Human-friendly permission names for the Roles & Permissions settings page. */
export const PERMISSION_LABELS: Record<string, string> = {
  "dashboard.view": "View dashboard",
  "pos.use": "Use POS / make sales",
  "sales.read": "View sales",
  "sales.refund": "Process refunds",
  "products.read": "View products",
  "products.write": "Create & edit products",
  "products.delete": "Delete products",
  "stock.read": "View stock & transactions",
  "stock.write": "Add / adjust / transfer stock",
  "categories.read": "View categories",
  "categories.write": "Manage categories",
  "discounts.read": "View discounts",
  "discounts.write": "Manage discounts",
  "branches.read": "View branch stats",
  "branches.write": "Manage branches",
  "branches.switch": "Switch active branch",
  "users.read": "View users",
  "users.write": "Manage users",
  "logs.read": "View activity logs",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function permissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? permission;
}
