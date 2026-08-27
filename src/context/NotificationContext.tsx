"use client";

// Global notification state. Mounted inside SocketProvider (layout.tsx) and
// listens on the app's single shared socket -- it no longer opens one of its
// own. See SocketContext for why the tab holds exactly one connection.
//
// Events consumed:
//   notification:new         → prepend to list, bump unread, sonner toast
//   refund-request:new       → window event "refund-requests:changed" (queue pages refetch)
//   refund-request:resolved  → window event "refund-requests:changed"
// Toasts come exclusively from notification:new to avoid double-toasting —
// the API fans out a notification row for every event we'd want to announce.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSocketEvent } from "@/context/SocketContext";
import {
  AppNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/refundRequests";

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refresh: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await listNotifications({ limit: 20 });
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      // Bell is non-critical; stay silent.
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markRead = useCallback(async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useSocketEvent<AppNotification>("notification:new", (n) => {
    setNotifications((prev) => [n, ...prev].slice(0, 50));
    setUnreadCount((c) => c + 1);
    const show =
      n.type === "low_stock"
        ? toast.warning
        : n.type === "refund_declined"
          ? toast.error
          : toast.info;
    show(n.title, { description: n.body });
  });

  // Refund queue pages listen for this window event and refetch.
  const queueChanged = useCallback(() => {
    window.dispatchEvent(new CustomEvent("refund-requests:changed"));
  }, []);
  useSocketEvent("refund-request:new", queueChanged);
  useSocketEvent("refund-request:resolved", queueChanged);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
