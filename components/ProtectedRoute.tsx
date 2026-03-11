"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth"); // sends user to login page if not logged in
    }
  }, [user, loading]);

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!user) return null;

  return <>{children}</>;
}