"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";

interface FarmerNavigationProps {
    currentFarmerId?: string;
    currentOfficerId?: string;
    orgId: string;
    prefix?: string; // e.g. "/management" or "/admin/organizations/[id]"
    heading?: string;
}

export const FarmerNavigation = ({ currentFarmerId, currentOfficerId, orgId, prefix = "", heading = "Explore Other Farmers" }: FarmerNavigationProps) => {
    const trpc = useTRPC();

    // Fetch a list of farmers. 
    // We fetch a bit more than needed to allow for client-side prioritization of same-officer farmers
    const { data, isLoading } = useQuery(
        trpc.farmers.getMany.queryOptions({
            orgId,
            pageSize: 20,
            sortBy: "createdAt",
            sortOrder: "desc"
        })
    );

    if (isLoading || !data?.items || data.items.length === 0) return null;

    // Filter out current farmer
    let farmers = data.items.filter(f => f.id !== currentFarmerId);

    // Prioritize farmers with the same officer ID
    if (currentOfficerId) {
        farmers.sort((a, b) => {
            const aIsSameOfficer = a.officerId === currentOfficerId;
            const bIsSameOfficer = b.officerId === currentOfficerId;
            if (aIsSameOfficer && !bIsSameOfficer) return -1;
            if (!aIsSameOfficer && bIsSameOfficer) return 1;
            return 0;
        });
    }

    // Limit to 4 suggestions as requested for the main view, 
    // but we can still show a "View All" link if there are more.
    // Actually, user said "suggest 3-4 farmers", so let's slice top 4 for the cards
    // and keep the "View All" for the rest.
    const suggestions = farmers.slice(0, 4);

    if (suggestions.length === 0) return null;

    return (
        <Card className="border-none shadow-sm bg-white overflow-hidden mt-8">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {heading}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-4 p-4 px-6 md:grid md:grid-cols-4 md:w-full md:space-x-0 md:gap-4">
                        {suggestions.map((farmer) => (
                            <Link
                                key={farmer.id}
                                href={`${prefix}/farmers/${farmer.id}`}
                                className="flex flex-col gap-1 w-[140px] md:w-auto p-3 rounded-xl border bg-slate-50/50 hover:bg-primary/5 hover:border-primary/20 transition-all group"
                            >
                                <div className="h-8 w-8 rounded-full bg-white border shadow-sm flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                    <span className="font-bold text-xs text-slate-600 group-hover:text-primary">
                                        {farmer.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <span className="font-bold text-sm text-slate-900 truncate group-hover:text-primary">
                                    {farmer.name}
                                </span>
                                <div className="flex items-center text-[10px] text-muted-foreground">

                                    <span className={farmer.activeCyclesCount > 0 ? "text-emerald-600 font-medium" : ""}>
                                        {farmer.activeCyclesCount} Active Cycle{farmer.activeCyclesCount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </Link>
                        ))}
                        <div className="md:hidden">
                            <Link
                                href={`${prefix}/farmers`}
                                className="flex flex-col items-center justify-center gap-1 w-[100px] p-3 rounded-xl border border-dashed bg-transparent hover:bg-slate-50 transition-all group"
                            >
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center mb-1 group-hover:bg-white transition-colors">
                                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                                </div>
                                <span className="font-bold text-xs text-slate-400 group-hover:text-slate-600">
                                    View All
                                </span>
                            </Link>
                        </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
};
