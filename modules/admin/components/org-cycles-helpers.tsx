import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Farmer, FarmerHistory } from "@/modules/cycles/types";
import { ActionsCell, HistoryActionsCell } from "@/modules/cycles/ui/components/shared/columns-factory";
import { Eye } from "lucide-react";
import Link from "next/link";

// Type for individual cycle items returned from the API
export type CycleItem = {
    id: string;
    name: string;
    farmerId: string;
    organizationId: string | null;
    doc: number;
    birdsSold: number;
    age: number;
    intake: string | number | null;
    mortality: number;
    status: "active" | "archived" | "deleted";
    createdAt: Date;
    updatedAt: Date;
    farmerName: string;
    farmerLocation?: string | null;
    farmerMobile?: string | null;
    farmerMainStock: string | null;
    officerName: string | null;
    endDate: Date | null;
    birdType?: string | null;
};

// Type for the paginated response from listActive/listPast
export type CyclesQueryResult = {
    items: CycleItem[];
    total: number;
    totalPages: number;
};

// --- Sub-components to lighten the main list view ---

export const StatusBadge = ({ status }: { status: CycleItem["status"] }) => {
    switch (status) {
        case "active":
            return null;
        case "deleted":
            return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/10 shadow-none font-bold text-[9px] uppercase tracking-wider">Deleted</Badge>;
        default:
            return <Badge variant="secondary" className="bg-muted text-muted-foreground border-none shadow-none font-bold text-[9px] uppercase tracking-wider">Past</Badge>;
    }
};

export const MetricRow = ({ icon: Icon, value, label, valueColor = "text-foreground" }: { icon: any, value: string | number, label: string, valueColor?: string }) => (
    <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground/50" />
        <span className={`text-sm font-bold ${valueColor}`}>{value}</span>
        <span className="text-[10px] text-muted-foreground font-normal lowercase">{label}</span>
    </div>
);

export const GroupRowActions = ({ cycle, prefix, isAdmin, isManagement, orgId }: { cycle: CycleItem, prefix: string, isAdmin?: boolean, isManagement?: boolean, orgId: string }) => (
    <div className="col-span-1 text-right flex items-center justify-end gap-1 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground/50 hover:text-primary hover:bg-primary/5" asChild>
            <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)}>
                <Eye className="h-3.5 w-3.5" />
            </Link>
        </Button>
        {cycle.status === "active" ? (
            <ActionsCell cycle={cycle as unknown as Farmer} prefix={prefix} />
        ) : (
            <HistoryActionsCell history={cycle as unknown as FarmerHistory} />
        )}
    </div>
);
