import { farmer, stockLogs } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

export interface FeedNeed {
    type?: string;
    quantity: number;
}

interface PlanLine {
    feedType: string | null;
    amount: number; // signed: negative = deduct, positive = restore
}

const getBalances = async (tx: any, farmerId: string) => {
    const rows = await tx.select({
        feedType: stockLogs.feedType,
        total: sql<string>`SUM(${stockLogs.amount})`
    })
        .from(stockLogs)
        .where(eq(stockLogs.farmerId, farmerId))
        .groupBy(stockLogs.feedType);

    const typeBalances = new Map<string, number>();
    let unspecifiedBalance = 0;
    rows.forEach((r: any) => {
        const amt = Number(r.total);
        if (r.feedType) typeBalances.set(r.feedType, amt);
        else unspecifiedBalance = amt;
    });
    return { typeBalances, unspecifiedBalance };
};

// Pure planning: given current balances and a list of positive "need to consume" quantities,
// deduct from each named type first, falling back to Unspecified for any shortfall, hard-blocking
// if even Unspecified can't cover it.
const planFeedConsumption = (
    typeBalances: Map<string, number>,
    unspecifiedBalance: number,
    needs: FeedNeed[]
): PlanLine[] => {
    const merged = new Map<string, number>();
    let unspecifiedNeeded = 0;
    needs.forEach(n => {
        const key = n.type?.trim();
        if (key) merged.set(key, (merged.get(key) ?? 0) + n.quantity);
        else unspecifiedNeeded += n.quantity;
    });

    const plan: PlanLine[] = [];
    let unspecifiedRemaining = unspecifiedBalance;

    for (const [type, needed] of merged.entries()) {
        const available = Math.max(typeBalances.get(type) ?? 0, 0);
        if (available >= needed - 0.0001) {
            plan.push({ feedType: type, amount: -needed });
            continue;
        }
        const shortfall = needed - available;
        if (available > 0.0001) plan.push({ feedType: type, amount: -available });
        if (unspecifiedRemaining >= shortfall - 0.0001) {
            plan.push({ feedType: null, amount: -shortfall });
            unspecifiedRemaining -= shortfall;
        } else {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Not enough "${type}" feed to cover ${needed.toFixed(1)} bags consumed (${available.toFixed(1)} in stock, ${Math.max(unspecifiedRemaining, 0).toFixed(1)} unspecified available).`
            });
        }
    }

    if (unspecifiedNeeded > 0.0001) {
        if (unspecifiedRemaining >= unspecifiedNeeded - 0.0001) {
            plan.push({ feedType: null, amount: -unspecifiedNeeded });
            unspecifiedRemaining -= unspecifiedNeeded;
        } else {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Not enough unspecified feed to cover ${unspecifiedNeeded.toFixed(1)} bags consumed (${Math.max(unspecifiedRemaining, 0).toFixed(1)} available).`
            });
        }
    }

    return plan;
};

// Applies a set of signed per-type plan lines: one farmer.mainStock update by the net total,
// plus one stockLogs row per (merged) feedType with a correct running balanceAfter chain.
const applyPlan = async (
    tx: any,
    farmerId: string,
    plan: PlanLine[],
    opts: { logType: string; referenceId: string; note: string }
): Promise<{ netAmount: number }> => {
    const merged = new Map<string | null, number>();
    plan.forEach(p => merged.set(p.feedType, (merged.get(p.feedType) ?? 0) + p.amount));
    const entries = Array.from(merged.entries()).filter(([, amt]) => Math.abs(amt) > 0.0001);
    if (entries.length === 0) return { netAmount: 0 };

    const farmerData = await tx.query.farmer.findFirst({ where: eq(farmer.id, farmerId) });
    const netAmount = entries.reduce((s, [, amt]) => s + amt, 0);

    await tx.update(farmer).set({
        mainStock: sql`${farmer.mainStock} + ${netAmount}`,
        updatedAt: new Date(),
    }).where(eq(farmer.id, farmerId));

    let running = farmerData.mainStock;
    const rows = entries.map(([feedType, amount]) => {
        running += amount;
        return {
            farmerId,
            amount: amount.toString(),
            type: opts.logType,
            referenceId: opts.referenceId,
            feedType,
            note: opts.note,
            balanceAfter: running.toString(),
        };
    });
    await tx.insert(stockLogs).values(rows);

    return { netAmount };
};

/**
 * Deducts a fresh set of feed consumption lines from a farmer's stock, per type, falling back to
 * Unspecified for any shortfall and hard-blocking (BAD_REQUEST) if even that isn't enough.
 */
export const deductFeedByType = async (
    tx: any,
    farmerId: string,
    feeds: FeedNeed[],
    opts: { logType: string; referenceId: string; note: string }
): Promise<{ netAmount: number }> => {
    const { typeBalances, unspecifiedBalance } = await getBalances(tx, farmerId);
    const plan = planFeedConsumption(typeBalances, unspecifiedBalance, feeds);
    return applyPlan(tx, farmerId, plan, opts);
};

/**
 * Adjusts stock for a correction: diffs old vs new per-type feed consumption and applies only the
 * delta per type. Types consuming more go through the same fallback/hard-block check as a fresh
 * deduction; types consuming less are simply restored to that same type (no check needed).
 */
export const adjustFeedByTypeDelta = async (
    tx: any,
    farmerId: string,
    oldFeeds: FeedNeed[],
    newFeeds: FeedNeed[],
    opts: { logType: string; referenceId: string; note: string }
): Promise<{ netAmount: number }> => {
    const oldMap = new Map<string, number>();
    oldFeeds.forEach(f => { const k = f.type?.trim(); if (k) oldMap.set(k, (oldMap.get(k) ?? 0) + f.quantity); });
    const newMap = new Map<string, number>();
    newFeeds.forEach(f => { const k = f.type?.trim(); if (k) newMap.set(k, (newMap.get(k) ?? 0) + f.quantity); });

    const allTypes = new Set([...oldMap.keys(), ...newMap.keys()]);
    const consumeNeeds: FeedNeed[] = [];
    const restoreLines: PlanLine[] = [];
    allTypes.forEach(type => {
        const delta = (newMap.get(type) ?? 0) - (oldMap.get(type) ?? 0);
        if (delta > 0.0001) consumeNeeds.push({ type, quantity: delta });
        else if (delta < -0.0001) restoreLines.push({ feedType: type, amount: -delta });
    });

    const { typeBalances, unspecifiedBalance } = await getBalances(tx, farmerId);
    const consumePlan = consumeNeeds.length ? planFeedConsumption(typeBalances, unspecifiedBalance, consumeNeeds) : [];
    return applyPlan(tx, farmerId, [...consumePlan, ...restoreLines], opts);
};

/**
 * Reverses every stockLogs row tied to a given referenceId+logType (e.g. all the CYCLE_CONSUMPTION
 * rows — typed and any Unspecified-fallback pieces — created when a cycle closed), mirroring each
 * one's exact feed type. Used when reopening/undoing a close.
 */
export const restoreFeedByReference = async (
    tx: any,
    referenceId: string,
    logType: string,
    note: string
): Promise<{ netAmount: number; farmerId: string | null }> => {
    const originalLogs = await tx.select().from(stockLogs)
        .where(and(eq(stockLogs.referenceId, referenceId), eq(stockLogs.type, logType)));
    if (originalLogs.length === 0) return { netAmount: 0, farmerId: null };

    const farmerId = originalLogs[0].farmerId;
    const farmerData = await tx.query.farmer.findFirst({ where: eq(farmer.id, farmerId) });
    let running = farmerData.mainStock;
    let netAmount = 0;

    const rows = originalLogs.map((log: any) => {
        const amt = typeof log.amount === 'string' ? parseFloat(log.amount) : log.amount;
        const restoreAmt = -amt;
        netAmount += restoreAmt;
        running += restoreAmt;
        return {
            farmerId,
            amount: restoreAmt.toString(),
            type: "ADJUSTMENT",
            referenceId: log.id,
            feedType: log.feedType,
            note,
            balanceAfter: running.toString(),
        };
    });

    if (Math.abs(netAmount) > 0.0001) {
        await tx.update(farmer).set({
            mainStock: sql`${farmer.mainStock} + ${netAmount}`,
            updatedAt: new Date(),
        }).where(eq(farmer.id, farmerId));
        await tx.insert(stockLogs).values(rows);
    }

    return { netAmount, farmerId };
};
