import assert from "node:assert/strict";
import { pickPolicy, type PolicyRow } from "../modules/pricing/lib/pick-policy";

const row = (officerId: string | null, from: string, feed = "3300"): PolicyRow => ({
    officerId,
    effectiveFrom: new Date(from),
    feedPricePerBag: feed,
    docPricePerBird: "41",
    baseSellPrice: "145",
});

const rows: PolicyRow[] = [
    row(null, "2026-01-01", "3200"),            // org default, older
    row(null, "2026-06-01", "3325"),            // org default, newer
    row("a", "2026-07-01", "3400"),             // officer a
    row("a", "2026-11-01", "3500"),             // officer a, newer
    row("b", "2026-05-01", "3100"),             // officer b
    row("a", "2027-01-01", "3999"),             // officer a, future
];

const at = (d: string) => new Date(d);

// officer's latest effective own policy wins
assert.equal(pickPolicy(rows, "a", at("2026-11-23"))!.feedPricePerBag, "3500");
// an older date uses the policy effective then
assert.equal(pickPolicy(rows, "a", at("2026-08-01"))!.feedPricePerBag, "3400");
// before the officer's first policy, the org default applies
assert.equal(pickPolicy(rows, "a", at("2026-06-15"))!.feedPricePerBag, "3325");
// an officer with no policy uses the org default, never another officer's
assert.equal(pickPolicy(rows, "c", at("2026-11-23"))!.feedPricePerBag, "3325");
// no officer id means org default only
assert.equal(pickPolicy(rows, null, at("2026-11-23"))!.feedPricePerBag, "3325");
// nothing effective yet returns null so the caller falls back to constants
assert.equal(pickPolicy(rows, "a", at("2025-12-31")), null);
assert.equal(pickPolicy([], "a", at("2026-11-23")), null);
// a policy dated exactly on the sale date is effective
assert.equal(pickPolicy(rows, "b", at("2026-05-01"))!.feedPricePerBag, "3100");

console.log("price policy resolution: all assertions passed");
