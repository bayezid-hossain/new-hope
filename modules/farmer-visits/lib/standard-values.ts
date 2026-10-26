export type StandardRow = {
    day: number;
    dailyFeedG: number;
    bodyWeightG: number;
    fcr: number | null;
};

// Days 0..35 are the supplied Ross table. Days 36..40 are EXTRAPOLATED from the last
// six days of that table (+100..104 g/day weight, +7 g/day feed, +0.018 FCR/day).
const DAILY_FEED_G = [
    0, 13, 17, 21, 23, 27, 31, 35, 39, 44, 48, 54, 58, 64, 68, 75, 81, 87, 93, 98,
    105, 111, 117, 123, 130, 134, 141, 148, 152, 158, 163, 169, 174, 180, 182, 189,
    // extrapolated 36..40
    196, 203, 210, 217, 224,
];

const BODY_WEIGHT_G = [
    42, 56, 72, 89, 109, 131, 157, 185, 215, 247, 283, 321, 364, 412, 465, 524, 586, 651, 719, 790,
    865, 943, 1023, 1104, 1186, 1269, 1353, 1438, 1524, 1613, 1705, 1799, 1895, 1993, 2092, 2191,
    // extrapolated 36..40
    2291, 2392, 2494, 2597, 2701,
];

// Day 0 has no FCR.
const FCR = [
    null, 0.232, 0.417, 0.573, 0.679, 0.773, 0.841, 0.902, 0.956, 1.012, 1.053, 1.097, 1.126, 1.15,
    1.165, 1.177, 1.191, 1.206, 1.221, 1.235, 1.25, 1.264, 1.284, 1.303, 1.321, 1.337, 1.356, 1.373,
    1.402, 1.423, 1.442, 1.46, 1.478, 1.496, 1.512, 1.53,
    // extrapolated 36..40
    1.548, 1.566, 1.584, 1.602, 1.62,
];

export const STANDARD_VALUES: StandardRow[] = DAILY_FEED_G.map((dailyFeedG, day) => ({
    day,
    dailyFeedG,
    bodyWeightG: BODY_WEIGHT_G[day],
    fcr: FCR[day],
}));
