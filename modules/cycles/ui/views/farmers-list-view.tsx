"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    ArrowRight,
    Bird,
    Loader2,
    Search,
    Users,
    Wheat
} from "lucide-react";
import Link from "next/link"; // Assuming Next.js navigation
import { useState } from "react";
// import { useDebounce } from "@/hooks/use-debounce"; // *See Note below if you don't have this

export const FarmersListView = () => {
  const { orgId } = useCurrentOrg();
  const trpc = useTRPC();
  
  // Local state for search
  const [searchTerm, setSearchTerm] = useState("");
  // Debounce search to avoid spamming the API (optional but recommended)
  // If you don't have a debounce hook, just pass searchTerm directly for now.
  const debouncedSearch = searchTerm; 

  const { data, isLoading } = useQuery(
    trpc.farmers.getMany.queryOptions({
        orgId: orgId!,
        search: debouncedSearch,
        pageSize: 50, // Fetch a good amount for the list
    }, { enabled: !!orgId })
  );

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto p-4 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight">Farmers Directory</h1>
           <p className="text-muted-foreground">Manage and monitor all farmers in your organization.</p>
        </div>
        {/* Search Bar */}
        <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search name or phone..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* Farmers Table Card */}
      <Card>
        <CardHeader>
           <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    All Farmers
                </CardTitle>
                <CardDescription>
                    Total Registered: {data?.total || 0}
                </CardDescription>
              </div>
           </div>
        </CardHeader>
        <CardContent>
           <div className="rounded-md border">
              <Table>
                <TableHeader>
                   <TableRow className="bg-muted/50">
                      <TableHead>Farmer Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active Cycles</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead className="text-right">Joined</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {isLoading ? (
                      <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Loading farmers...
                              </div>
                          </TableCell>
                      </TableRow>
                   ) : data?.items.map((farmer) => (
                      <TableRow key={farmer.id} className="group">
                         {/* Name & Phone */}
                         <TableCell>
                            <div className="font-medium">{farmer.name}</div>
                            
                         </TableCell>
                         
                         {/* Status (derived logic) */}
                         <TableCell>
                            {farmer.activeCyclesCount > 0 ? (
                                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                            ) : (
                                <Badge variant="secondary">Idle</Badge>
                            )}
                         </TableCell>

                         {/* Active Cycles Count */}
                         <TableCell>
                            <div className="flex items-center gap-1.5">
                                <Bird className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{farmer.activeCyclesCount}</span>
                                <span className="text-xs text-muted-foreground">cycles</span>
                            </div>
                         </TableCell>

                         {/* Main Warehouse Stock */}
                         <TableCell>
                            <div className="flex items-center gap-1.5">
                                <Wheat className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-medium">{farmer.mainStock.toFixed(1)}</span>
                                <span className="text-xs text-muted-foreground">bags</span>
                            </div>
                         </TableCell>

                         {/* Joined Date */}
                         <TableCell className="text-right text-muted-foreground text-sm">
                            {format(new Date(farmer.createdAt), "MMM d, yyyy")}
                         </TableCell>

                         {/* Action: Link to History View */}
                         <TableCell>
                            <Button size="icon" variant="ghost" asChild>
                                {/* Update this HREF to match your routing structure */}
                                <Link href={`/farmers/${farmer.id}/history`}>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                                </Link>
                            </Button>
                         </TableCell>
                      </TableRow>
                   ))}

                   {!isLoading && data?.items.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                              No farmers found matching "{searchTerm}".
                          </TableCell>
                      </TableRow>
                   )}
                </TableBody>
              </Table>
           </div>
        </CardContent>
      </Card>
    </div>
  );
};