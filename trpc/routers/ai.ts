
import { cycleLogs, cycles, farmer, member } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import Groq from "groq-sdk";
import { z } from "zod";
import { createTRPCRouter, proProcedure } from "../init";

const callAiWithFallback = async (groq: Groq, messages: any[]) => {
    // Fallback Model List (Order of preference)
    const MODELS = ['meta-llama/llama-4-scout-17b-16e-instruct',
        "llama-3.3-70b-versatile",
        "mixtral-8x7b-32768",
        "gemma2-9b-it"
    ];

    let lastError = null;

    for (const model of MODELS) {
        try {
            //conosle.log(`[AI] Attempting with model: ${model}`);
            const completion = await groq.chat.completions.create({
                messages,
                model,
                temperature: 0.3,
                max_tokens: 8192,
                response_format: { type: "json_object" }
            });

            // Log Token Usage
            const usage = completion.usage;
            if (usage) {
                console.log(`[AI Usage] Model: ${model} | Prompt: ${usage.prompt_tokens} | Completion: ${usage.completion_tokens} | Total: ${usage.total_tokens}`);
            }

            return completion.choices[0]?.message?.content;
        } catch (error: any) {
            console.warn(`[AI] Failed with ${model}:`, error.message);
            lastError = error;
        }
    }
    throw new Error(`All AI models failed. Last error: ${lastError?.message}`);
};

const sanitizeInput = (text: string) => {
    // Labels that usually indicate noise lines
    const noiseLabels = ["location", "phn", "phone", "address", "delivery date", "order date", "feed order", "feed delivery"];
    const noiseLabelRegex = new RegExp(`^(${noiseLabels.join("|")})\\b:?`, "i");

    // Explicit noise patterns
    const noisePatterns = [
        /^farm\s+no\s+\d+/i,  // "Farm No 01"
        /^(dear\s+)?(sir|madam)\b:?$/i, // Just "Dear Sir" or "Sir" on a line
        /^(regards|sincerely|hi|hello)\b:?$/i // Just "Regards" etc.
    ];

    const phoneRegex = /\b\d[\d\s-]{6,}\d\b/;
    // Data Protection: If a line has a number followed by 'bags', 'bg', 'kg', or 'birds', keep it.
    const dataLineRegex = /\d+\s*(bag|bg|kg|bird|doc)/i;
    const protectedPrefixRegex = /^(farmer|name|customer):\s*/i;

    const lines = text.split("\n");
    const kept: string[] = [];
    const removed: string[] = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const isDataLine = dataLineRegex.test(trimmed);
        const isProtected = protectedPrefixRegex.test(trimmed);

        // If it starts with "Farmer:", "Name:", or looks like direct stock data, it's a keeper.
        if (isProtected || isDataLine) {
            kept.push(line);
            return;
        }

        const isNoiseLabel = noiseLabelRegex.test(trimmed);
        const isNoisePattern = noisePatterns.some(p => p.test(trimmed));
        const hasPhone = phoneRegex.test(trimmed);

        if (isNoiseLabel || isNoisePattern || hasPhone) {
            removed.push(line);
        } else {
            kept.push(line);
        }
    });

    const cleanText = kept.join("\n").trim();

    console.log(`--- [AI Sanitization] ---`);
    console.log(`Original lines: ${lines.length} | Kept: ${kept.length} | Removed: ${removed.length}`);
    if (removed.length > 0) {
        console.log(`Removed lines:`, removed.map(l => l.trim()));
    }
    console.log(`-------------------------`);

    return cleanText;
};

export const aiRouter = createTRPCRouter({
    extractFarmers: proProcedure
        .input(z.object({
            text: z.string(),
            candidates: z.array(z.object({
                id: z.string(),
                name: z.string()
            })).default([])
        }))
        .mutation(async ({ input }) => {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

            // Sanitize Input Text
            const cleanText = sanitizeInput(input.text);
            const candidatesList = input.candidates.map(c => `- ${c.name} (ID: ${c.id})`).join("\n");
            console.log(cleanText)
            const systemPrompt = `
            You are an intelligent data extraction and matching engine.
            Goal: Extract farmer names and their TOTAL feed bag count.
            Match against CANDIDATE LIST:
            ${candidatesList}
            
            IMPORTANT: If a farmer appears multiple times in the text, SUM their amounts into a single entry with the TOTAL.
            CRITICAL: You must extract EVERY SINGLE farmer mentioned in the text. DO NOT stop after a few. DO NOT summarize. Process the entire text.
            If there are 50 farmers, return 50 entries.
            Return a valid STRICT JSON Object with a "farmers" key. Do not output any markdown formatting or explanation. 
            Format: { "farmers": [{ "original_name": "string", "amount": number, "matched_id": "string|null", "confidence": "HIGH"|"MEDIUM"|"LOW", "suggestions": [] }] }
            `;

            try {
                // Use the fallback mechanism which enforces json_object mode
                const aiResponse = await callAiWithFallback(groq, [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: cleanText }
                ]);

                // Robust JSON Parsing
                let parsed: any = {};
                try {
                    // 1. Try direct parse
                    parsed = JSON.parse(aiResponse || "{}");
                } catch (e) {
                    // 2. Try extracting JSON from code blocks or curly braces
                    const jsonMatch = (aiResponse || "").match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            parsed = JSON.parse(jsonMatch[0]);
                        } catch (e2) {
                            console.error("Failed to parse extracted JSON:", e2);
                            throw new Error("Invalid JSON structure in AI response");
                        }
                    } else {
                        throw new Error("No JSON object found in AI response");
                    }
                }

                let data = [];
                if (parsed.farmers && Array.isArray(parsed.farmers)) data = parsed.farmers;
                else if (Array.isArray(parsed)) data = parsed;
                else if (parsed.data && Array.isArray(parsed.data)) data = parsed.data;
                else return [];
                //conosle.log("Extracted Data:", data);
                const mappedData = data.map((item: any) => ({
                    name: item.original_name || item.name || "Unknown",
                    amount: Number(item.amount) || 0,
                    matchedId: item.matched_id || null,
                    confidence: item.confidence || "LOW",
                    suggestions: Array.isArray(item.suggestions) ? item.suggestions : []
                }));

                // Aggregation Logic: Merge duplicates based on matchedId or name
                const aggregatedMap = new Map<string, typeof mappedData[0]>();

                for (const item of mappedData) {
                    // Use matchedId as primary key, fallback to name (normalized)
                    const key = item.matchedId ? `ID:${item.matchedId}` : `NAME:${item.name.toLowerCase().trim()}`;

                    if (aggregatedMap.has(key)) {
                        const existing = aggregatedMap.get(key)!;
                        existing.amount += item.amount;
                        // Keep the one with higher confidence if merging
                        if (existing.confidence !== "HIGH" && item.confidence === "HIGH") {
                            existing.confidence = "HIGH";
                            existing.matchedId = item.matchedId; // Update ID if better match found
                            existing.suggestions = item.suggestions;
                        }
                    } else {
                        aggregatedMap.set(key, { ...item });
                    }
                }

                return Array.from(aggregatedMap.values());

            } catch (e: any) {
                console.error("AI Extract Failed:", e);
                // Return empty instead of crashing to allow UI to handle it gracefully or show empty state
                return [];
            }
        }),

    generateRiskAssessment: proProcedure
        .input(z.object({
            orgId: z.string(),
            officerId: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Security Check
            if (!input.officerId) {
                // ORG-WIDE SCAN: Requires Global Admin or Org Admin/Owner
                if (ctx.user.globalRole !== "ADMIN") {
                    const membership = await ctx.db.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, input.orgId),
                            eq(member.status, "ACTIVE")
                        )
                    });

                    if (!membership || (membership.role !== "OWNER" && membership.role !== "MANAGER")) {
                        throw new TRPCError({
                            code: "FORBIDDEN",
                            message: "Organization-wide analysis requires Manager or Owner privileges."
                        });
                    }
                }
            } else {
                // OFFICER-SPECIFIC SCAN: Access to own data or Admin override
                if (ctx.user.globalRole !== "ADMIN" && input.officerId !== ctx.user.id) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "You can only analyze your own data." });
                }
            }


            const activeCycles = await ctx.db.select({
                cycleId: cycles.id,
                cycleName: cycles.name,
                doc: cycles.doc,
                age: cycles.age,
                farmerName: farmer.name,
                currentMortality: cycles.mortality,
                currentIntake: cycles.intake,
                farmerId: farmer.id
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(and(
                    eq(cycles.organizationId, input.orgId),
                    eq(cycles.status, "active"),
                    eq(farmer.status, "active"),
                    input.officerId ? eq(farmer.officerId, input.officerId) : undefined
                ));

            if (activeCycles.length === 0) {
                return { risks: [], summary: "No active cycles to analyze." };
            }

            const riskFlags: { farmer: string; type: string; detail: string }[] = [];

            for (const cycle of activeCycles) {
                const recentLogs = await ctx.db.select()
                    .from(cycleLogs)
                    .where(and(
                        eq(cycleLogs.cycleId, cycle.cycleId),
                        eq(cycleLogs.type, "MORTALITY"),
                        gt(cycleLogs.createdAt, sql`NOW() - INTERVAL '3 DAYS'`)
                    ))
                    .orderBy(desc(cycleLogs.createdAt));

                const recentMortalitySum = recentLogs.reduce((sum, log) => sum + log.valueChange, 0);
                const mortalityRate3Days = (recentMortalitySum / cycle.doc);

                if (mortalityRate3Days > 0.01) {
                    riskFlags.push({
                        farmer: cycle.farmerName,
                        type: "HIGH_MORTALITY",
                        detail: `Lost ${recentMortalitySum} birds (${(mortalityRate3Days * 100).toFixed(2)}%) in last 3 days.`
                    });
                } else if (mortalityRate3Days > 0.005) {
                    riskFlags.push({
                        farmer: cycle.farmerName,
                        type: "RISING_MORTALITY",
                        detail: `Lost ${recentMortalitySum} birds in last 3 days.`
                    });
                }
            }

            if (riskFlags.length === 0) {
                return {
                    risks: [],
                    summary: "✅ Smart Watchdog Scan: All active cycles appear stable based on recent data."
                };
            }

            const criticalCount = riskFlags.filter(f => f.type === "HIGH_MORTALITY").length;
            const warningCount = riskFlags.filter(f => f.type === "RISING_MORTALITY").length;

            let summary = `✅ Smart Watchdog Scan: All active cycles appear stable.`;
            if (criticalCount > 0 || warningCount > 0) {
                summary = `⚠️ Watchdog Alert: Found ${criticalCount} critical and ${warningCount} warning conditions needing attention.`;
            }

            return {
                summary,
                risks: riskFlags.map(f => ({
                    farmer: f.farmer,
                    level: f.type === "HIGH_MORTALITY" ? "CRITICAL" : "WARNING",
                    message: f.detail
                }))
            };
        }),

    generateSupplyChainPrediction: proProcedure
        .input(z.object({
            orgId: z.string(),
            officerId: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Security Check
            if (!input.officerId) {
                // ORG-WIDE SCAN: Requires Global Admin or Org Admin/Owner
                if (ctx.user.globalRole !== "ADMIN") {
                    const membership = await ctx.db.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, input.orgId),
                            eq(member.status, "ACTIVE")
                        )
                    });

                    if (!membership || (membership.role !== "OWNER" && membership.role !== "MANAGER")) {
                        throw new TRPCError({
                            code: "FORBIDDEN",
                            message: "Organization-wide analysis requires Manager or Owner privileges."
                        });
                    }
                }
            } else {
                // OFFICER-SPECIFIC SCAN: Access to own data or Admin override
                if (ctx.user.globalRole !== "ADMIN" && input.officerId !== ctx.user.id) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "You can only analyze your own data." });
                }
            }

            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

            const rows = await ctx.db.select({
                farmerId: farmer.id,
                farmerName: farmer.name,
                mainStock: farmer.mainStock,
                cycleId: cycles.id,
                doc: cycles.doc,
                age: cycles.age,
            })
                .from(farmer)
                .leftJoin(cycles, and(eq(cycles.farmerId, farmer.id), eq(cycles.status, "active")))
                .where(and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.status, "active"),
                    input.officerId ? eq(farmer.officerId, input.officerId) : undefined
                ));

            const criticalFarmers: { farmer: string; stock: number; burnRate: string; daysRemaining: string; urgency: string }[] = [];

            for (const row of rows) {
                if (!row.cycleId) continue;

                const recentFeedLogs = await ctx.db.select()
                    .from(cycleLogs)
                    .where(and(
                        eq(cycleLogs.cycleId, row.cycleId),
                        eq(cycleLogs.type, "FEED"),
                        gt(cycleLogs.createdAt, sql`NOW() - INTERVAL '3 DAYS'`)
                    ));

                let dailyBurnRate = 0;
                if (recentFeedLogs.length > 0) {
                    const totalRecentIntake = recentFeedLogs.reduce((sum, log) => sum + (log.valueChange || 0), 0);
                    dailyBurnRate = totalRecentIntake / 3;
                }

                if (dailyBurnRate === 0) {
                    const estimatedGramsPerBird = Math.min(180, Math.max(20, (row?.age ?? 0) * 5));
                    dailyBurnRate = ((row?.doc ?? 0) * estimatedGramsPerBird) / 1000;
                    dailyBurnRate = dailyBurnRate / 50;
                }

                if (dailyBurnRate <= 0) dailyBurnRate = 1;

                const daysRemaining = row.mainStock / dailyBurnRate;

                if (daysRemaining < 4) {
                    criticalFarmers.push({
                        farmer: row.farmerName,
                        stock: row.mainStock,
                        burnRate: dailyBurnRate.toFixed(2),
                        daysRemaining: daysRemaining.toFixed(2),
                        urgency: daysRemaining < 2 ? "CRITICAL" : "HIGH"
                    });
                }
            }

            if (criticalFarmers.length === 0) {
                return { status: "OK", message: "Supply chain healthy. No immediate stockouts predicted.", predictions: [] };
            }

            return {
                status: "WARNING",
                message: "Stockout risks detected.",
                predictions: criticalFarmers,
                aiPlan: null
            };
        }),
});
