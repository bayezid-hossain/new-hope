"use client";

import LoadingState from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const trpc = useTRPC();

  // We fetch the full user profile to check globalRole
  const { data: session, isPending } = useQuery(trpc.auth.getSession.queryOptions());
  // ^ Assuming you have a basic auth router. If not, check ctx.user in a specialized query.

  useEffect(() => {
    if (!isPending && session && session.user) {
      const isAdmin = session.user.globalRole === "ADMIN";
      const isModeAdmin = session.user.activeMode === "ADMIN";

      if (!isAdmin || !isModeAdmin) {
        router.push("/");
      }
    }
  }, [session, isPending, router]);

  if (isPending || !session?.user || session.user.globalRole !== "ADMIN" || session.user.activeMode !== "ADMIN") {
    return <LoadingState title="Verifying Admin Access" description="Veryfying Admin Access" />;
  }

  return <>{children}</>;
};