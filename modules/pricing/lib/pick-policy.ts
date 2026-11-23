export type PolicyRow = {
    officerId: string | null;
    effectiveFrom: Date;
    feedPricePerBag: string;
    docPricePerBird: string;
    baseSellPrice: string;
};

const latest = (rows: PolicyRow[]): PolicyRow | null =>
    rows.reduce<PolicyRow | null>((best, r) => (!best || r.effectiveFrom > best.effectiveFrom ? r : best), null);

// Officer's own latest policy effective on `date`, else the org default's, else null (caller uses constants).
export function pickPolicy(rows: PolicyRow[], officerId: string | null, date: Date): PolicyRow | null {
    const effective = rows.filter((r) => r.effectiveFrom <= date);
    const own = officerId ? latest(effective.filter((r) => r.officerId === officerId)) : null;
    return own ?? latest(effective.filter((r) => r.officerId === null));
}
