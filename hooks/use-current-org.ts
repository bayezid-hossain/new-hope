"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export function useCurrentOrg() {
  const trpc = useTRPC();
  
  const { data, isPending } = useQuery(
    trpc.organization.getMyStatus.queryOptions(undefined, {
      staleTime: 1000 * 60 * 5, // Cache this for 5 minutes (org membership changes rarely)
    })
  );

  return {
    orgId: data?.orgId,
    role: data?.role,
    isLoading: isPending,
    isAuthenticated: data?.status === "ACTIVE",
  };
}