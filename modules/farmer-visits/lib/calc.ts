export type FeedLine = { type: string; intake: number; running: number; stock: number };

export const MAX_STD_DAY = 40;
export const KG_PER_BAG = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export function clampStdDay(age: number): number {
    return Math.min(MAX_STD_DAY, Math.max(0, Math.trunc(age)));
}

export function sumFeed(lines: FeedLine[], key: "intake" | "running" | "stock"): number {
    const total = lines.reduce((sum, l) => sum + (Number.isFinite(l[key]) ? l[key] : 0), 0);
    return Math.round(total * 100) / 100;
}

export function calcLiveBirds(doc: number, mortality: number, birdsOut: number): number {
    return Math.max(0, doc - mortality - birdsOut);
}

// FCR = feed consumed (kg) / (avg weight kg * live birds). "Running" bags are the consumed feed.
export function calcAvgFcr(p: { runningBags: number; avgWeightG: number; liveBirds: number }): number {
    const liveWeightKg = (p.avgWeightG / 1000) * p.liveBirds;
    if (liveWeightKg <= 0) return 0;
    return Math.round(((p.runningBags * KG_PER_BAG) / liveWeightKg) * 1000) / 1000;
}

// visitDate is "yyyy-MM-dd". The server runs in UTC while farms are not, so both bounds
// carry a one-day buffer instead of comparing against exact local midnights.
export function validateVisitDate(visitDate: string, cycleStart: Date, now: Date): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || Number.isNaN(new Date(visitDate).getTime())) {
        return "Invalid date format, expected yyyy-MM-dd";
    }
    const earliest = new Date(cycleStart.getTime() - DAY_MS).toISOString().slice(0, 10);
    const latest = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);
    if (visitDate < earliest) return "Visit date cannot be before the cycle start date";
    if (visitDate > latest) return "Visit date cannot be in the future";
    return null;
}
