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
  1: 16, 2: 36, 3: 60, 4: 88, 5: 120,
  6: 156, 7: 196, 8: 240, 9: 288, 10: 340,
  11: 396, 12: 456, 13: 520, 14: 588, 15: 660,
  16: 736, 17: 816, 18: 900, 19: 988, 20: 1080,
  21: 1176, 22: 1276, 23: 1380, 24: 1488, 25: 1600,
  26: 1716, 27: 1836, 28: 1960, 29: 2088, 30: 2220,
  31: 2356, 32: 2496, 33: 2640, 34: 2788,
  35: 2864, 36: 2944, 37: 3028, 38: 3116, 39: 3208, 40: 3304
};

// Helper to safely get cumulative feed, defaulting to max known if age > 40
export const getCumulativeFeedForDay = (day: number): number => {
  if (day <= 0) return 0;
  if (day > 40) return CUMULATIVE_FEED_SCHEDULE[40]; // Cap at max or extrapolate logic here
  return CUMULATIVE_FEED_SCHEDULE[day] || 0;
};

// Profit Calculation Constants
export const FEED_PRICE_PER_BAG = 3220;
export const DOC_PRICE_PER_BIRD = 41.5;
export const BASE_SELLING_PRICE = 141;