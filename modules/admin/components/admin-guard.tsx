"use client";


import { useLoading } from "@/components/providers/loading-provider";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";


export const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const trpc = useTRPC();
  const { showLoading, hideLoading } = useLoading();


  // We fetch the full user profile to check globalRole
  const { data: session, isPending } = useQuery(trpc.auth.getSession.queryOptions());
  // ^ Assuming you have a basic auth router. If not, check ctx.user in a specialized query.

  useEffect(() => {
    if (isPending) {
      showLoading("Verifying Admin Access...");
    } else {
      hideLoading();
    }

    if (!isPending && session && session.user) {
      const isAdmin = session.user.globalRole === "ADMIN";
      const isModeAdmin = session.user.activeMode === "ADMIN";

      if (!isAdmin || !isModeAdmin) {
        // If we redirect, we let layout handle hiding loading via pathname check, 
        // or we hide it explicitly? `hideLoading` above handles the `isPending` false case.
        // If we push, pathname changes, so LoadingProvider handles it.
        router.push("/");
      }
    }
  }, [session, isPending, router, showLoading, hideLoading]);

  if (isPending || !session?.user || session.user.globalRole !== "ADMIN" || session.user.activeMode !== "ADMIN") {
    return null;
  }

  return <>{children}</>;
};