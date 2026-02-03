
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface FeedConsumptionChartProps {
    feedChartData: Array<{
        name: string; // Farmer name
        bags: number; // Total Intake
    }>;
    history?: boolean;
}

export const FeedConsumptionChart = ({ feedChartData, history }: FeedConsumptionChartProps) => {
    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-border/50 bg-card/50 backdrop-blur-sm rounded-[2rem] overflow-hidden group shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-tight">Feed Consumption</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Top feed consumers {history ? "(past)" : "(active)"}
                        </CardDescription>
                    </div>
                    <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ring-1 ring-primary/20">
                        <Activity className="h-4 w-4" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={feedChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" opacity={0.5} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--muted-foreground)' }}
                                width={80}
                                tickLine={false}
                                axisLine={false}
                                className="uppercase tracking-tighter"
                            />
                            <Tooltip
                                cursor={{ fill: 'var(--muted)', opacity: 0.15 }}
                                contentStyle={{
                                    borderRadius: '16px',
                                    backgroundColor: 'var(--card)',
                                    border: '1px solid var(--border)',
                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                    padding: '12px'
                                }}
                                itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}
                            />
                            <Bar
                                dataKey="bags"
                                fill="var(--primary)"
                                radius={[0, 8, 8, 0]}
                                barSize={28}
                                className="opacity-90 hover:opacity-100 transition-opacity"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};
