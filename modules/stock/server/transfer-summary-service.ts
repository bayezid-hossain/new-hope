import { farmer, stockLogs } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";

type Db = any;

// Officers must own one of the two farmers, management must belong to the org of one of them.
export type TransferAccess = { orgId?: string; officerId?: string; isAdmin?: boolean };

export type TransferLine = { feedType: string | null; quantity: number };

export type TransferSummary = {
    referenceId: string;
    date: Date;
    fromFarmer: string;
    toFarmer: string;
    lines: TransferLine[];
    reverted: boolean;
};

// Everything needed to write the transfer message, rebuilt from the stock logs that share a
// referenceId. The other farm's name is only free text in a log note, so it is joined here instead.
export async function getTransferSummary(db: Db, access: TransferAccess, referenceId: string): Promise<TransferSummary> {
    const rows = await db
        .select({
            log: stockLogs,
            farmerName: farmer.name,
            officerId: farmer.officerId,
            organizationId: farmer.organizationId,
        })
        .from(stockLogs)
        .innerJoin(farmer, eq(stockLogs.farmerId, farmer.id))
        .where(and(eq(stockLogs.referenceId, referenceId), inArray(stockLogs.type, ["TRANSFER_OUT", "TRANSFER_IN"])));

    if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer not found" });

    const allowed = access.isAdmin
        || rows.some((r: any) => (access.officerId ? r.officerId === access.officerId : false)
            || (access.orgId ? r.organizationId === access.orgId : false));
    if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this transfer" });

    const outRows = rows.filter((r: any) => r.log.type === "TRANSFER_OUT");
    const inRows = rows.filter((r: any) => r.log.type === "TRANSFER_IN");

    // One credit row per feed line is written exactly as sent, so it is the truest record of what
    // moved. The debit side can be split across types, so it is only a fallback.
    const quantityRows = inRows.length > 0 ? inRows : outRows;
    const byType = new Map<string, number>();
    for (const r of quantityRows) {
        const key = r.log.feedType ?? "";
        byType.set(key, (byType.get(key) ?? 0) + Math.abs(Number(r.log.amount)));
    }
    const lines: TransferLine[] = [...byType.entries()].map(([type, quantity]) => ({
        feedType: type || null,
        quantity: Math.round(quantity * 100) / 100,
    }));

    // A revert writes an ADJUSTMENT row whose referenceId is the id of the transfer row it undoes.
    const adjustments = await db
        .select({ id: stockLogs.id })
        .from(stockLogs)
        .where(and(eq(stockLogs.type, "ADJUSTMENT"), inArray(stockLogs.referenceId, rows.map((r: any) => r.log.id))))
        .limit(1);

    return {
        referenceId,
        date: new Date(Math.min(...rows.map((r: any) => new Date(r.log.createdAt).getTime()))),
        fromFarmer: outRows[0]?.farmerName ?? "",
        toFarmer: inRows[0]?.farmerName ?? "",
        lines,
        reverted: adjustments.length > 0,
    };
}
