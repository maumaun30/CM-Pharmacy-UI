"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/context/NotificationContext";
import type { AppNotification } from "@/lib/refundRequests";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function targetFor(n: AppNotification): string {
  if (n.type === "low_stock") return "/stock";
  return "/refunds";
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const router = useRouter();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="cursor-pointer relative h-9 w-9 p-0 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400"
          variant="outline"
          size="sm"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-emerald-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="mb-2 w-80 p-0 border-emerald-200">
        <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-100">
          <span className="font-bold text-sm text-emerald-700">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="cursor-pointer text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No notifications</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.is_read) markRead(n.id);
                  router.push(targetFor(n));
                }}
                className={`cursor-pointer w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-emerald-50/60 transition-colors ${
                  n.is_read ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
                    <p className="text-xs text-gray-600 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
