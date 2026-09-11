"use client";

// app/time/_components/ConsoleGuard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Auth + capability gate for /time.
//
// This does not reuse <RoleProtectedRoute> for one reason: that component wraps
// its children in `max-w-7xl m-auto`, and the console spec is explicitly fluid
// ("no viewport-locked layout, grids reflow, wide tables scroll inside their
// card"). Everything else — redirect on signed-out, render the shared Navbar —
// matches ProtectedRoute's behaviour.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { ShieldAlert } from "lucide-react";
import { canOpenConsole } from "../_lib/permissions";

export default function ConsoleGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = canOpenConsole(user);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (!allowed) {
      // Staff clock in from the phone app; the console is supervisors only.
      router.push("/");
    }
  }, [loading, user, allowed, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-[#d1fae5]">
            <ShieldAlert className="h-8 w-8 text-[#059669]" />
          </div>
          <p className="font-medium text-[#64748b]">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  if (!user || !allowed) return null; // redirecting

  return (
    <>
      {children}
      <Navbar />
    </>
  );
}
