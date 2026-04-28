"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  role: string;
  first_name: string;
  last_name: string;
  contact_number?: string;
  branch_id: number;
  current_branch_id: number | null;
  is_active: boolean;
  branch?: { id: number; name: string; code: string; is_active: boolean; email?: string; phone?: string };
  currentBranch?: { id: number; name: string; code: string; is_active: boolean; email?: string; phone?: string };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    let token: string | null = null;
    try {
      token = window.localStorage?.getItem?.("token") ?? null;
    } catch {
      setLoading(false);
      return;
    }
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      try { window.localStorage?.removeItem?.("token"); } catch {}
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(() => {
    try { localStorage.removeItem("token"); } catch {}
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: fetchUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
