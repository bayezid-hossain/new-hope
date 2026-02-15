import { z } from "zod";

/**
 * Zod schema for a single feed item (type + bags).
 * Used in sell-modal, adjust-sale-modal, and sales-report forms.
 */
export const feedItemSchema = z.object({
    type: z.string().min(1, "Required"),
    bags: z.number().min(0, "Must be 0 or greater"),
});

/** TypeScript type derived from the Zod schema */
export type FeedItem = z.infer<typeof feedItemSchema>;
