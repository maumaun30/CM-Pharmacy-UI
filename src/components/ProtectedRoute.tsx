"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";

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

  if (loading || !user) return <p className="text-center mt-20">Loading...</p>;

  return (
    <>
      <main className="relative h-screen">
        <section className="h-full max-w-7xl m-auto pb-16">{children}</section>
      </main>
      <Navbar />
    </>
  );
}
