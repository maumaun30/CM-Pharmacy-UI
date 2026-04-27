"use client";

// Re-export from AuthContext so all components share the same auth state
export { useAuth, type AuthUser as User } from "@/context/AuthContext";
