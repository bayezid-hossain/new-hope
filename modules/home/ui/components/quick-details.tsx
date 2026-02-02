
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
        farmerMainStock: number;
        intake: number;
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
                    <CardTitle className="text-sm xs:text-base">Recent Activity</CardTitle>
                    <CardDescription className="text-[10px] xs:text-xs">
                        Latest active cycles overview
                    </CardDescription>
                </div>
                <Button asChild size="sm" className="ml-auto gap-1 h-7 text-[10px] xs:h-8 xs:text-xs">
                    <Link href="/cycles">
                        View <ArrowUpRight className="h-3 w-3 xs:h-4 xs:w-4" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="text-[10px] xs:text-xs">
                            <TableHead className="px-1 xs:px-4">Farmer</TableHead>
                            <TableHead className="px-1 xs:px-4 text-center">Bags</TableHead>
                            <TableHead className="px-1 xs:px-4 text-right">Age</TableHead>
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
                                <TableRow key={cycle.id} className="text-[10px] xs:text-xs">
                                    <TableCell className="px-1 xs:px-4">
                                        <div className="font-bold">{cycle.farmerName}</div>
                                        <div className="text-[9px] text-muted-foreground xs:text-xs">
                                            {cycle.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-1 xs:px-4 text-center">
                                        <div className="font-semibold text-amber-700">{cycle.intake.toFixed(1)}</div>
                                        <div className="text-[9px] text-slate-400 xs:text-[10px]">/{cycle.farmerMainStock.toFixed(0)}</div>
                                    </TableCell>
                                    <TableCell className="px-1 xs:px-4 text-right whitespace-nowrap">
                                        {cycle.age}d
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
