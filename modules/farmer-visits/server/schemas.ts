import { z } from "zod";

const bags = z.number().min(0).max(100000);

export const feedLineSchema = z.object({
    type: z.string().trim().min(1).max(20),
    intake: bags,
    running: bags,
    stock: bags,
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected yyyy-MM-dd");

export const saveInputSchema = z.object({
    cycleId: z.string(),
    visitDate: isoDate,
    age: z.number().int().min(0).max(200),
    todayMortality: z.number().int().min(0).max(200000),
    totalMortality: z.number().int().min(0).max(200000),
    avgWeightG: z.number().int().min(0).max(10000),
    feedLines: z.array(feedLineSchema).max(12),
    litter: z.string().max(2000).default(""),
    disease: z.string().max(2000).default(""),
    medicine: z.string().max(2000).default(""),
    suggestions: z.string().max(4000).default(""),
}).superRefine((val, ctx) => {
    const seen = new Set<string>();
    for (const line of val.feedLines) {
        const key = line.type.toLowerCase();
        if (seen.has(key)) {
            ctx.addIssue({ code: "custom", path: ["feedLines"], message: `Duplicate feed type "${line.type}"` });
        }
        seen.add(key);
    }
});

export const listInputSchema = z.object({
    search: z.string().optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    sort: z.enum(["date", "farmer"]).default("date"),
    order: z.enum(["asc", "desc"]).default("desc"),
    cursor: z.number().int().min(1).default(1), // page number
    pageSize: z.number().int().min(1).max(50).default(20),
});

export const prefillInputSchema = z.object({ cycleId: z.string(), date: isoDate });
export const idInputSchema = z.object({ id: z.string() });
export const standardInputSchema = z.object({ age: z.number().int().min(0).max(200) });

export type SaveInput = z.infer<typeof saveInputSchema>;
export type ListInput = z.infer<typeof listInputSchema>;
