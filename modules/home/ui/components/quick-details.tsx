
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface QuickDetailsProps {
    cycles: Array<{
        id: string;
        name: string;
        farmerName: string;
        age: number;
        doc: number;
        status: string;
    }>;
}

export const QuickDetails = ({ cycles }: QuickDetailsProps) => {
    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                        Latest active cycles overview
                    </CardDescription>
                </div>
                <Button asChild size="sm" className="ml-auto gap-1">
                    <Link href="/cycles">
                        View All <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Desc</TableHead>
                            <TableHead>Age</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cycles.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    No active cycles found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            cycles.slice(0, 5).map((cycle) => (
                                <TableRow key={cycle.id}>
                                    <TableCell>
                                        <div className="font-medium">{cycle.farmerName}</div>
                                        <div className="hidden text-sm text-muted-foreground md:inline">
                                            {cycle.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>{cycle.age} Days</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                            Active
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
