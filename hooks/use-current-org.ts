"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export function useCurrentOrg() {
  const trpc = useTRPC();

  const query = useQuery(
    trpc.auth.getMyMembership.queryOptions(undefined, {
      staleTime: 1000 * 60 * 5, // Cache this for 5 minutes (org membership changes rarely)
    })
  );

  return {
    ...query,
    ...query.data,
    orgId: query.data?.orgId,
    role: query.data?.role,
    isPro: query.data?.isPro ?? false,
    isLoading: query.isPending,
    isAuthenticated: query.data?.status === "ACTIVE",
  };
}