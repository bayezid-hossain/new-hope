
import { cycleLogs, cycles, farmer } from "@/db/schema";
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
            
            Return JSON array: [{ "original_name": "string", "amount": number, "matched_id": "string|null", "confidence": "HIGH"|"MEDIUM"|"LOW", "suggestions": [] }]
            `;

            try {
                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: input.text }
                    ],
                    model: "llama-3.3-70b-versatile",
                    temperature: 0,
                });

                const content = completion.choices[0]?.message?.content || "[]";
                const jsonString = content.replace(/```json\n?|\n?```/g, "").trim();
                const parsed = JSON.parse(jsonString);

                let data = [];
                if (Array.isArray(parsed)) data = parsed;
                else if (parsed.farmers && Array.isArray(parsed.farmers)) data = parsed.farmers;
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
                throw new Error("Failed to parse AI response.");
            }
        }),

    generateRiskAssessment: proProcedure
        .input(z.object({
            orgId: z.string(),
            officerId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Security Check: Users can only scan themselves unless they are ADMIN
            if (ctx.user.globalRole !== "ADMIN" && input.officerId !== ctx.user.id) {
                throw new TRPCError({ code: "FORBIDDEN", message: "You can only analyze your own data." });
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
                    eq(farmer.officerId, input.officerId)
                ));

            if (activeCycles.length === 0) {
                return { risks: [], summary: "No active cycles to analyze." };
            }

            const riskFlags = [];

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
            officerId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Security Check
            if (ctx.user.globalRole !== "ADMIN" && input.officerId !== ctx.user.id) {
                throw new TRPCError({ code: "FORBIDDEN", message: "You can only analyze your own data." });
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
                    eq(farmer.officerId, input.officerId)
                ));

            const criticalFarmers = [];

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
