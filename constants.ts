export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

// lib/constants.ts
// @/constants.ts

export const GRAMS_PER_BAG = 50000; // Assuming 50kg bags

// CUMULATIVE Feed Schedule (Grams per bird up to Day X)
// Day 1: 16
// Day 2: 16 + 20 = 36
// Day 3: 36 + 24 = 60 ...and so on.
export const CUMULATIVE_FEED_SCHEDULE: Record<number, number> = {
  0: 0, // Base case for new farmers
  1: 13, 2: 30, 3: 51, 4: 74, 5: 101,
  6: 132, 7: 167, 8: 206, 9: 250, 10: 298,
  11: 352, 12: 410, 13: 474, 14: 542, 15: 617,
  16: 698, 17: 785, 18: 878, 19: 976, 20: 1081,
  21: 1192, 22: 1309, 23: 1432, 24: 1562, 25: 1696,
  26: 1837, 27: 1985, 28: 2137, 29: 2295, 30: 2458,
  31: 2627, 32: 2801, 33: 2981, 34: 3163, 35: 3352,
  // Days 36-40: daily intake grows by +7 g/day (day 35 minus day 34)
  36: 3548, 37: 3751, 38: 3961, 39: 4178, 40: 4402
};

// Helper to safely get cumulative feed, defaulting to max known if age > 40
export const getCumulativeFeedForDay = (day: number): number => {
  if (day <= 0) return 0;
  if (day > 40) return CUMULATIVE_FEED_SCHEDULE[40]; // Cap at max or extrapolate logic here
  return CUMULATIVE_FEED_SCHEDULE[day] || 0;
};

// Profit Calculation Constants
export const FEED_PRICE_PER_BAG = 3325;
export const DOC_PRICE_PER_BIRD = 41.5;
export const BASE_SELLING_PRICE = 145;