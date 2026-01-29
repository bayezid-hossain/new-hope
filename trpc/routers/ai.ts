
import { cycleLogs, cycles, farmer, member } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import Groq from "groq-sdk";
import { z } from "zod";
import { createTRPCRouter, proProcedure } from "../init";

const callAiWithFallback = async (groq: Groq, messages: any[]) => {
    // Fallback Model List (Order of preference)
    const MODELS = [
        "llama-3.3-70b-versatile",

    ];

    let lastError = null;

    for (const model of MODELS) {
        try {
            console.log(`[AI] Attempting with model: ${model}`);
            const completion = await groq.chat.completions.create({
                messages,
                model,
                temperature: 0.3,
                max_tokens: 250,
                response_format: { type: "json_object" }
            });

            return completion.choices[0]?.message?.content;
        } catch (error: any) {
            console.warn(`[AI] Failed with ${model}:`, error.message);
            lastError = error;
        }
    }
    throw new Error(`All AI models failed. Last error: ${lastError?.message}`);
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

            const candidatesList = input.candidates.map(c => `- ${c.name} (ID: ${c.id})`).join("\n");

            const systemPrompt = `
            You are an intelligent data extraction and matching engine.
            Goal: Extract farmer names and their TOTAL feed bag count.
            Match against CANDIDATE LIST:
            ${candidatesList}
            
            Return a valid STRICT JSON Object with a "farmers" key. Do not output any markdown formatting or explanation. 
            Format: { "farmers": [{ "original_name": "string", "amount": number, "matched_id": "string|null", "confidence": "HIGH"|"MEDIUM"|"LOW", "suggestions": [] }] }
            `;

            try {
                // Use the fallback mechanism which enforces json_object mode
                const aiResponse = await callAiWithFallback(groq, [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: input.text }
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

                return data.map((item: any) => ({
                    name: item.original_name || item.name || "Unknown",
                    amount: Number(item.amount) || 0,
                    matchedId: item.matched_id || null,
                    confidence: item.confidence || "LOW",
                    suggestions: Array.isArray(item.suggestions) ? item.suggestions : []
                }));

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

            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
                        detail: `Lost ${recentMortalitySum} birds (${(mortalityRate3Days * 100).toFixed(1)}%) in last 3 days.`
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

            const systemPrompt = `
            You are a Poultry Risk Analyst. Review RISK FLAGS.
            Goal: Prioritize risks (CRITICAL/WARNING) and provide 1-sentence action.
            Return JSON: { "summary": "string", "risks": [{ "farmer": "string", "level": "CRITICAL"|"WARNING", "message": "string" }] }
            `;

            try {
                const aiResponse = await callAiWithFallback(groq, [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: JSON.stringify(riskFlags) }
                ]);

                return aiResponse ? JSON.parse(aiResponse) : { risks: [], summary: "AI analysis failed." };
            } catch (error) {
                return {
                    summary: "⚠️ AI Offline. Showing raw system alerts.",
                    risks: riskFlags.map(f => ({
                        farmer: f.farmer,
                        level: f.type === "HIGH_MORTALITY" ? "CRITICAL" : "WARNING",
                        message: f.detail
                    }))
                };
            }
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
                        burnRate: dailyBurnRate.toFixed(1),
                        daysRemaining: daysRemaining.toFixed(1),
                        urgency: daysRemaining < 2 ? "CRITICAL" : "HIGH"
                    });
                }
            }

            if (criticalFarmers.length === 0) {
                return { status: "OK", message: "Supply chain healthy. No immediate stockouts predicted.", predictions: [] };
            }

            const systemPrompt = `
            You are a Logistics Manager.
            Goal: Suggest restocking priority.
            Input: [{ farmer, stock: bags, daysRemaining }]
            `;

            try {
                const aiResponse = await callAiWithFallback(groq, [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: JSON.stringify(criticalFarmers) }
                ]);

                return {
                    status: "WARNING",
                    message: "Stockout risks detected.",
                    predictions: criticalFarmers,
                    aiPlan: aiResponse ? JSON.parse(aiResponse) : null
                };
            } catch (e) {
                return {
                    status: "WARNING",
                    message: "Stockout risks detected (AI Plan Unavailable).",
                    predictions: criticalFarmers,
                    aiPlan: null
                };
            }
        }),
});
