"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { LoaderCircle } from "lucide-react";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading || !user)
    return (
      <div className="fixed inset-0 h-full w-full flex items-center justify-center pointer-events-none z-50 gap-1">
        <LoaderCircle className="animate-spin" />
        Loading ...
      </div>
    );

  return (
    <>
      <main className="relative">
        <section className="h-full max-w-7xl m-auto pb-16">{children}</section>
      </main>
      <Navbar />
    </>
  );
}
