import { FeedItem } from "@/modules/shared/types/feed";

/**
 * Ensures B1 and B2 feed types are present in the array and sorted to the top.
 * Used by both sell-modal and adjust-sale-modal when initializing feed values.
 */
export const ensureB1B2 = (items: FeedItem[] = []): FeedItem[] => {
    const result = [...items];
    if (!result.find(i => i.type.toUpperCase() === "B1")) {
        result.push({ type: "B1", bags: 0 });
    }
    if (!result.find(i => i.type.toUpperCase() === "B2")) {
        result.push({ type: "B2", bags: 0 });
    }
    // Sort to keep B1 and B2 at top
    return result.sort((a, b) => {
        const typeA = a.type.toUpperCase();
        const typeB = b.type.toUpperCase();
        if (typeA === "B1") return -1;
        if (typeB === "B1") return 1;
        if (typeA === "B2") return -1;
        if (typeB === "B2") return 1;
        return 0;
    });
};
