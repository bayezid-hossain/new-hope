"use client";

import ErrorState from "@/components/error-state";
import LoadingState from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query"; // Import useQuery directly
import { NoOrgState } from "./no-org-state";
import { PendingState } from "./pending-state";
import { RejectedState } from "./rejected-view";

interface OrgGuardProps {
  children: React.ReactNode;
}

export const OrgGuard = ({ children }: OrgGuardProps) => {
  const trpc = useTRPC();
  
  // FIXED: Use standard useQuery + queryOptions
  const { data: statusData, isPending, error } = useQuery(
    trpc.organization.getMyStatus.queryOptions(undefined, {
       retry: 1,
    })
  );

  if (isPending) {
    return <LoadingState title="Checking Access" description="Verifying organization membership..." />;
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
      
    case "ACTIVE":
    default:
      return <>{children}</>;
  }
};