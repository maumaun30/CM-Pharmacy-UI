"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { canAny } from "@/lib/permissions";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  // Legacy role gate (still supported). Prefer `requiredPermissions` so access
  // tracks the capability, not a hardcoded role.
  allowedRoles?: string[]; // e.g., ["admin", "manager"]
  // Permission gate: access granted if the user holds ANY of these.
  requiredPermissions?: string[]; // e.g., ["products.write"]
  fallbackPath?: string; // Where to redirect if not authorized
  showUnauthorized?: boolean; // Show unauthorized message instead of redirect
}

export default function RoleProtectedRoute({
  children,
  allowedRoles,
  requiredPermissions,
  fallbackPath = "/",
  showUnauthorized = false,
}: RoleProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // A user is authorized when they satisfy the permission gate (preferred) or,
  // if none is given, fall back to the legacy role list.
  const isAuthorized = (u: NonNullable<typeof user>): boolean => {
    if (requiredPermissions && requiredPermissions.length > 0) {
      return canAny(u, requiredPermissions);
    }
    if (allowedRoles && allowedRoles.length > 0) {
      // Superadmin passes every legacy role gate — it sits above admin.
      return u.role === "superadmin" || allowedRoles.includes(u.role);
    }
    return true; // authenticated is enough
  };

  useEffect(() => {
    if (!loading && !user) {
      // Not logged in - redirect to login
      router.push("/login");
    } else if (!loading && user && !isAuthorized(user)) {
      // Logged in but not authorized
      if (!showUnauthorized) {
        router.push(fallbackPath);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, router, allowedRoles, requiredPermissions, fallbackPath, showUnauthorized]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4 animate-pulse">
            <ShieldAlert className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="text-gray-600 font-medium">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  // User not logged in
  if (!user) {
    return null; // Will redirect via useEffect
  }

  // User logged in but unauthorized
  if (!isAuthorized(user)) {
    if (showUnauthorized) {
      return (
        <>
          <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
            <Card className="max-w-md w-full p-8 text-center border-2 border-red-200">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-6">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-800 mb-3">
                Access Denied
              </h1>
              
              <p className="text-gray-600 mb-2">
                You don't have permission to access this page.
              </p>
              
              <p className="text-sm text-gray-500 mb-6">
                {requiredPermissions && requiredPermissions.length > 0 ? (
                  <>
                    Requires: <span className="font-semibold text-red-600">
                      {requiredPermissions.join(" or ")}
                    </span>
                  </>
                ) : (
                  <>
                    Required role: <span className="font-semibold text-red-600">
                      {(allowedRoles ?? []).join(" or ")}
                    </span>
                  </>
                )}
                <br />
                Your role: <span className="font-semibold text-gray-700">
                  {user.role}
                </span>
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => router.back()}
                  variant="outline"
                  className="flex-1"
                >
                  Go Back
                </Button>
                <Button
                  onClick={() => router.push("/dashboard")}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                >
                  Go to Dashboard
                </Button>
              </div>
            </Card>
          </div>
          <Navbar />
        </>
      );
    }
    return null; // Will redirect via useEffect
  }

  // User is authorized
  return (
    <>
      <main className="relative">
        <section className="h-full max-w-7xl m-auto">{children}</section>
      </main>
      <Navbar />
    </>
  );
}