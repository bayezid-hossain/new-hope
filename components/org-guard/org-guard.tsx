"use client";

import ErrorState from "@/components/error-state";
import { useLoading } from "@/components/providers/loading-provider";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query"; // Import useQuery directly
import { useEffect } from "react";
import { InactiveState } from "./inactive-view";
import { NoOrgState } from "./no-org-state";
import { PendingState } from "./pending-state";
import { RejectedState } from "./rejected-view";

interface OrgGuardProps {
  children: React.ReactNode;
}

export const OrgGuard = ({ children }: OrgGuardProps) => {
  const trpc = useTRPC();


  const { showLoading, hideLoading } = useLoading();

  // FIXED: Use standard useQuery + queryOptions
  const { data: statusData, isPending, error } = useQuery(
    trpc.auth.getMyMembership.queryOptions(undefined, {
      retry: 1,
    })
  );

  useEffect(() => {
    if (isPending) {
      showLoading("Checking Access...");
    } else {
      hideLoading();
    }
  }, [isPending, showLoading, hideLoading]);

  if (isPending) {
    return null;
  }

  if (error || !statusData) {
    return <ErrorState title="Authentication Error" description="Could not verify your access status." />;
  }

  switch (statusData.status) {
    case "NO_ORG":
      return <NoOrgState />;

    case "PENDING":
      return <PendingState orgName={statusData.orgName || "Organization"} />;

    case "REJECTED":
      return <RejectedState orgName={statusData.orgName || "Organization"} />;

    case "INACTIVE":
      return <InactiveState orgName={statusData.orgName || "Organization"} />;

    case "ACTIVE":
    default:
      return <>{children}</>;
  }
};