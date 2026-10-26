import assert from "node:assert/strict";
import {
    calcAvgFcr,
    calcLiveBirds,
    clampStdDay,
    sumFeed,
    validateVisitDate,
    type FeedLine,
} from "../modules/farmer-visits/lib/calc";
import { STANDARD_VALUES } from "../modules/farmer-visits/lib/standard-values";

// --- standard table shape ---
assert.equal(STANDARD_VALUES.length, 41, "days 0..40");
STANDARD_VALUES.forEach((r, i) => assert.equal(r.day, i, `day ${i} in order`));
assert.deepEqual(STANDARD_VALUES[0], { day: 0, dailyFeedG: 0, bodyWeightG: 42, fcr: null });
assert.deepEqual(STANDARD_VALUES[20], { day: 20, dailyFeedG: 105, bodyWeightG: 865, fcr: 1.25 });
assert.deepEqual(STANDARD_VALUES[35], { day: 35, dailyFeedG: 189, bodyWeightG: 2191, fcr: 1.53 });
for (let d = 1; d <= 40; d++) {
    assert.ok(STANDARD_VALUES[d].bodyWeightG > STANDARD_VALUES[d - 1].bodyWeightG, `weight rises at ${d}`);
}

// --- clampStdDay ---
assert.equal(clampStdDay(-3), 0);
assert.equal(clampStdDay(20), 20);
assert.equal(clampStdDay(55), 40);
assert.equal(clampStdDay(12.9), 12);

// --- sumFeed ---
const lines: FeedLine[] = [
    { type: "B1", intake: 15, running: 15, stock: 0 },
    { type: "B2", intake: 13, running: 9, stock: 4 },
    { type: "Starter", intake: 0.5, running: 0.25, stock: 1 },
];
assert.equal(sumFeed(lines, "intake"), 28.5);
assert.equal(sumFeed(lines, "running"), 24.25);
assert.equal(sumFeed(lines, "stock"), 5);
assert.equal(sumFeed([], "running"), 0);

// --- calcLiveBirds ---
assert.equal(calcLiveBirds(1000, 11, 0), 989);
assert.equal(calcLiveBirds(1000, 11, 300), 689);
assert.equal(calcLiveBirds(10, 20, 0), 0, "never negative");

// --- calcAvgFcr: 24 bags = 1200 kg, 0.91 kg * 989 birds = 899.99 kg ---
assert.equal(calcAvgFcr({ runningBags: 24, avgWeightG: 910, liveBirds: 989 }), 1.333);
assert.equal(calcAvgFcr({ runningBags: 24, avgWeightG: 0, liveBirds: 989 }), 0);
assert.equal(calcAvgFcr({ runningBags: 24, avgWeightG: 910, liveBirds: 0 }), 0);

// --- validateVisitDate (one-day buffer each side for timezone skew) ---
const start = new Date("2026-10-01T00:00:00Z");
const now = new Date("2026-10-26T10:00:00Z");
assert.equal(validateVisitDate("2026-10-26", start, now), null);
assert.equal(validateVisitDate("2026-10-27", start, now), null, "buffer after");
assert.match(validateVisitDate("2026-10-28", start, now)!, /future/);
assert.equal(validateVisitDate("2026-09-30", start, now), null, "buffer before");
assert.match(validateVisitDate("2026-09-29", start, now)!, /before the cycle start/);
assert.match(validateVisitDate("26/10/2026", start, now)!, /format/);

console.log("farmer-visit calc: all assertions passed");
