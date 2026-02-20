
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
        mortality: number;
        birdsSold?: number;
        status: string;
    }>;
}

export const QuickDetails = ({ cycles }: QuickDetailsProps) => {
    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 border-border/50 bg-card/50 backdrop-blur-sm rounded-[2rem] overflow-hidden group shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-6">
                <div className="space-y-1">
                    <CardTitle className="text-sm font-black uppercase tracking-tight">Recent Activity</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                        Operational Overview
                    </CardDescription>
                </div>
                <Button asChild size="sm" variant="secondary" className="h-9 px-4 font-black uppercase text-[10px] tracking-widest rounded-xl bg-background border-border/50 hover:bg-primary hover:text-white transition-all shadow-sm">
                    <Link href="/cycles">
                        View All <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                <div className="rounded-2xl border border-border/50 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-border/50 hover:bg-transparent">
                                <TableHead className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-muted-foreground/70">Farmer</TableHead>
                                <TableHead className="px-4 py-3 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground/70">Birds</TableHead>
                                <TableHead className="px-4 py-3 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground/70">Feed</TableHead>
                                <TableHead className="px-4 py-3 text-right font-black text-[10px] uppercase tracking-widest text-muted-foreground/70">Age</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cycles.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">No active cycles found.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                cycles.slice(0, 5).map((cycle) => {
                                    const liveBirds = cycle.doc - cycle.mortality - (cycle.birdsSold || 0);
                                    const mortalityRate = cycle.doc > 0 ? ((cycle.mortality / cycle.doc) * 100).toFixed(1) : "0";
                                    return (
                                        <TableRow key={cycle.id} className="border-border/50 group/row hover:bg-muted/30 transition-colors">
                                            <TableCell className="px-4 py-4">
                                                <div className="font-black text-xs uppercase tracking-tight group-hover/row:text-primary transition-colors">{cycle.farmerName}</div>

                                            </TableCell>
                                            <TableCell className="px-4 py-4 text-center">
                                                <div className="font-black text-sm text-emerald-500">{liveBirds.toLocaleString()}</div>
                                                <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
                                                    {mortalityRate}% mort
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-4 text-center">
                                                <div className="font-black text-sm text-amber-500">{cycle.intake.toFixed(0)}</div>
                                                <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">/{cycle.farmerMainStock.toFixed(0)} bags</div>
                                            </TableCell>
                                            <TableCell className="px-4 py-4 text-right">
                                                <span className="inline-flex items-center justify-center bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-[10px] font-black">
                                                    {cycle.age}D
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
