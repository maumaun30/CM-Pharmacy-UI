import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getFullName(user: { first_name?: string; last_name?: string; username?: string } | null) {
  if (!user) return "Unknown";
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.username || "Unknown";
}