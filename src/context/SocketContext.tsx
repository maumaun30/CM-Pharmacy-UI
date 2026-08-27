"use client";

// The app's single Socket.IO connection.
//
// Every page used to open its own socket (dashboard, POS, notification bell),
// so one browser tab held three connections to the droplet — three handshakes,
// three heartbeats, and triple the HTTP long-polling whenever the websocket
// upgrade was blocked. This provider owns one connection and hands listeners
// out through `useSocketEvent`.
//
// Room membership is NOT negotiated here. The server derives it from the JWT at
// handshake time (see API `utils/socket.js`): it joins `user-<id>`, the active
// `branch-<id>`, and `admin-all` for admins. Client-side `join-branch` emits
// were redundant for the default branch, so they're gone — which also removes a
// hazard: with a shared socket, one page emitting `leave-branch` on unmount
// would have silently deafened every other listener in the tab.
//
// Because rooms are fixed at handshake, a branch switch needs a fresh
// connection — hence `effectiveBranch` in the effect's dependencies.

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

function resolveSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  // Fall back to the REST base URL with the /api suffix trimmed — the socket
  // server runs on the same HTTP server as Express.
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, "");
  return base || "http://localhost:5000";
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Reconnect when the active branch changes: the server picks rooms from the
  // user row at handshake, so an existing socket would stay in the old branch.
  const effectiveBranch = user?.current_branch_id ?? user?.branch_id ?? null;

  useEffect(() => {
    if (!user) return;

    let token: string | null = null;
    try {
      token = window.localStorage?.getItem?.("token") ?? null;
    } catch {
      return;
    }
    if (!token) return;

    const next = io(resolveSocketUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    next.on("connect", () => setIsConnected(true));
    next.on("disconnect", () => setIsConnected(false));
    next.on("connect_error", () => setIsConnected(false));

    setSocket(next);

    return () => {
      next.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user?.id, effectiveBranch]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

/**
 * Subscribe to one server event for the lifetime of the calling component.
 *
 * The handler is held in a ref, so an inline arrow function (which is a new
 * reference on every render) does not detach and re-attach the listener each
 * render — only a change of socket or event name does.
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
