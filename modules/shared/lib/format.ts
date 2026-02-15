import type { FeedItem } from "../types/feed";

/**
 * Formats an array of feed items as a multi-line breakdown string.
 * Example: "B1: 10 Bags\nB2: 5 Bags"
 */
export function formatFeedBreakdown(items: FeedItem[]): string {
    return items.map((i) => `${i.type}: ${i.bags} Bags`).join("\n");
}

/**
 * Sums the `bags` values across all feed items.
 */
export function calculateTotalBags(items: FeedItem[]): number {
    return items.reduce((acc, item) => acc + item.bags, 0);
}
