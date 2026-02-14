
import { cycleLogs, cycles, farmer, member } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import Fuse from "fuse.js";
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

const sanitizeOrderInput = (text: string) => {
    const lines = text.split("\n");
    const cleanedLines: string[] = [];

    // Stop processing if we hit "Total:"
    const stopRegex = /^Total\s*:/i;

    for (const line of lines) {
        const trimmed = line.trim();

        if (stopRegex.test(trimmed)) {
            break;
        }

        // Filter Rules
        // 1. Remove "Dear sir/ Boss" etc.
        if (/^(dear\s+)?(sir|boss|madam)/i.test(trimmed)) continue;

        // 2. Remove "Doc order under..."
        if (/^doc\s+order\s+under/i.test(trimmed)) continue;

        // 3. Remove "Contact/Contract farm doc"
        if (/^(contact|contract)\s+farm\s+doc/i.test(trimmed)) continue;

        // 4. Remove "Farm no: 01" but KEEP "04. Name"
        // "Farm no:..." pattern removal
        if (/^farm\s+no\s*:/i.test(trimmed)) continue;

        cleanedLines.push(line);
    }

    const result = cleanedLines.join("\n").trim();
    // Debug Log
    console.log(`[AI Sanitization] Input length: ${text.length} -> Output length: ${result.length}`);
    // console.log(result); 

    return result;
};

export type Candidate = {
    id: string;
    name: string;
};

export type MatchResult = {
    matchedId: string | null;
    matchedName: string | null;
    confidence: "HIGH" | null;
    suggestions: {
        id: string;
        name: string;
        score: number;
    }[];
};

/**
 * Normalize names for strict comparison
 */
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[^\w\s]/g, "");
}

/**
 * Smart Farmer Matcher
 *
 * RULES:
 * - Exact normalized match → AUTO MATCH
 * - Anything else → Suggestions only
 * - Even 1 character difference → NOT auto match
 */
export function matchFarmer(
    inputName: string,
    candidates: Candidate[]
): MatchResult {
    const normalizedInput = normalizeName(inputName);

    let matchedId: string | null = null;
    let matchedName: string | null = null;
    let confidence: "HIGH" | null = null;

    // -------------------------
    // 1️⃣ STRICT EXACT MATCH ONLY
    // -------------------------
    const exactMatch = candidates.find(
        (c) => normalizeName(c.name) === normalizedInput
    );

    if (exactMatch) {
        matchedId = exactMatch.id;
        matchedName = exactMatch.name;
        confidence = "HIGH";
    }

    // -------------------------
    // 2️⃣ ALWAYS GENERATE SUGGESTIONS
    // -------------------------
    const fuse = new Fuse(candidates, {
        keys: ["name"],
        threshold: 0.7, // Very lenient for suggestions
        distance: 100,
        ignoreLocation: true,
        includeScore: true,
        findAllMatches: true,
        minMatchCharLength: 4,
    });

    const suggestions = fuse
        .search(inputName)
        .slice(0, 5)
        .map((r) => ({
            id: r.item.id,
            name: r.item.name,
            score: r.score ?? 0,
        }));

    return {
        matchedId,
        matchedName,
        confidence,
        suggestions,
    };
}

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

            const baseCleanText = input.text;
            const candidates = input.candidates.map(c => ({ id: c.id, name: c.name }));

            // Metadata Regex
            const mobileRegex = /(?:\+?88)?01[3-9]\d{8}/;
            const locationRegex = /(?:Loc(?:ation)?|Address)\s*[:.-]?\s*(.*)$/im;

            const systemPrompt = `
            You are an intelligent data extraction and matching engine.
            Goal: Extract farmer names and their TOTAL feed bag count.
            
            IMPORTANT: If a farmer appears multiple times in the text, SUM their amounts into a single entry with the TOTAL.
            CRITICAL: You must extract EVERY SINGLE farmer mentioned in the text. DO NOT stop after a few. DO NOT summarize. Process the entire text.
            If there are 50 farmers, return 50 entries.
            Return a valid STRICT JSON Object with a "farmers" key. Do not output any markdown formatting or explanation. 
            Format: { "farmers": [{ "original_name": "string", "amount": number }] }
            `;

            try {
                // Use the fallback mechanism which enforces json_object mode
                const aiResponse = await callAiWithFallback(groq, [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: baseCleanText }
                ]);

                // Robust JSON Parsing
                let parsed: any = {};
                try {
                    parsed = JSON.parse(aiResponse || "{}");
                } catch (e) {
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

                let lastSearchIndex = 0;
                const originalLines = baseCleanText.split("\n");

                const mappedData = data.map((item: any) => {
                    const originalName = (item.original_name || item.name || "Unknown").trim();

                    // --- Metadata Rehydration ---
                    let extractedMobile = null;
                    let extractedLocation = null;

                    // Find where this name appears in the original text (starting from last found index)
                    let matchedLineIndex = -1;
                    const normalizedTarget = normalizeName(originalName);

                    for (let i = lastSearchIndex; i < originalLines.length; i++) {
                        const line = originalLines[i];
                        if (normalizeName(line).includes(normalizedTarget) && normalizedTarget.length > 3) {
                            matchedLineIndex = i;
                            break;
                        }
                    }

                    if (matchedLineIndex !== -1) {
                        lastSearchIndex = matchedLineIndex + 1; // Start searching next item after this line

                        // Scan forward for Metadata
                        for (let k = matchedLineIndex + 1; k < Math.min(matchedLineIndex + 8, originalLines.length); k++) {
                            const subLine = originalLines[k].trim();
                            if (!subLine) continue;

                            // Check Mobile
                            const mobileMatch = subLine.match(mobileRegex);
                            if (mobileMatch && !extractedMobile) {
                                extractedMobile = mobileMatch[0];
                            }

                            // Check Location
                            const locMatch = subLine.match(locationRegex);
                            if (locMatch && !extractedLocation) {
                                extractedLocation = locMatch[1] || subLine.replace(/Loc(?:ation)?\s*[:.-]?/i, "").trim();
                            }
                        }
                    }

                    const { matchedId, matchedName, confidence, suggestions } = matchFarmer(originalName, candidates);

                    return {
                        name: originalName,
                        amount: Number(item.amount) || 0,
                        matchedId,
                        matchedName,
                        confidence,
                        suggestions,
                        location: extractedLocation || item.location || null,
                        mobile: extractedMobile || item.mobile || null
                    };
                });

                // Aggregation Logic: Merge duplicates based on matchedId or name
                const aggregatedMap = new Map<string, typeof mappedData[0]>();

                for (const item of mappedData) {
                    const key = item.matchedId ? `ID:${item.matchedId}` : `NAME:${item.name.toLowerCase().trim()}`;

                    if (aggregatedMap.has(key)) {
                        const existing = aggregatedMap.get(key)!;
                        existing.amount += item.amount;

                        // Always try to fill in missing metadata
                        existing.location = existing.location || item.location;
                        existing.mobile = existing.mobile || item.mobile;

                        // Keep the one with higher confidence if merging
                        if (existing.confidence !== "HIGH" && item.confidence === "HIGH") {
                            existing.confidence = "HIGH";
                            existing.matchedId = item.matchedId;
                            existing.suggestions = item.suggestions;
                        }
                    } else {
                        aggregatedMap.set(key, { ...item });
                    }
                }

                return Array.from(aggregatedMap.values());

            } catch (e: any) {
                console.error("AI Extract Failed:", e);
                return [];
            }
        }),

    extractCycleOrders: proProcedure
        .input(z.object({
            text: z.string(),
            orgId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

            // Fetch Candidates (Farmers belonging to the current officer in this org)
            const dbCandidates = await ctx.db.select({
                id: farmer.id,
                name: farmer.name,
            })
                .from(farmer)
                .where(and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active")
                ));

            const candidates = dbCandidates.map(f => ({ id: f.id, name: f.name }));
            const candidatesList = candidates.map(c => `- ${c.name} (ID: ${c.id})`).join("\n");

            // Sanitize Input Here
            const baseCleanText = sanitizeOrderInput(input.text);

            // Metadata Extraction Strategy:
            // 1. Save original sanitized text.
            // 2. Remove Mobile and Location lines to create `aiInputText`.
            // 3. Send `aiInputText` to AI.
            // 4. In `mappedData`, find name in original text, then scan forward for metadata.

            const mobileRegex = /(?:\+?88)?01[3-9]\d{8}/;
            const locationRegex = /(?:Loc(?:ation)?|Address)\s*[:.-]?\s*(.*)$/im;

            // Create AI Input by removing metadata lines
            const aiInputLines = baseCleanText.split("\n").filter(line => {
                const isMobile = mobileRegex.test(line);
                const isLocation = locationRegex.test(line);
                return !isMobile && !isLocation;
            });
            const aiInputText = aiInputLines.join("\n");

            console.log(`[AI Optimization] Original Len: ${baseCleanText.length} -> AI Input Len: ${aiInputText.length}`);

            const systemPrompt = `
You extract poultry order data from raw text.

Return STRICT JSON only. No explanation.

TASK:
Extract:
- order_date
- farmer name
- doc (quantity)
- bird_type

DATE RULE:
- Extract from header like: "Date: 11 February 26"
- Convert to YYYY-MM-DD.
- If missing → null.

NAME RULES (VERY STRICT):

1. If a line matches this pattern at the START:
   ^[0-9]{1,2}\.\s
   (Example: "04. Mohammad Suhel Rana")
   → REMOVE the numeric prefix including dot.
   → Keep the remaining name.

2. If a number appears WITHOUT a dot
   Example: "3014 Bismillah sanitary and poultry"
   → KEEP the number.
   → It is part of the name.

3. Lines starting with:
   "Farm no"
   "Farm No"
   "Farm no:"
   "Farm No:"
   → IGNORE completely.
   These are NOT farmer names.

4. If a block contains:
   "Farm name:"
   → The text after ":" is the farmer name.

5. If a block contains:
   "Farmer:"
   → The text after ":" is the farmer name.

QUANTITY RULE:
- Extract number near "Quantity" or "pcs".
- Must be numeric.
- Required.

BIRD TYPE RULE:
- Examples: Ross A, EP A, EP. A
- Normalize:
  - Remove extra dots
  - Trim spaces
- If missing → null.

IGNORE:
- Location
- Mobile
- Total summary section

IMPORTANT:
- Extract ALL farmer blocks.
- Do not merge blocks.
- Do not drop numeric prefixes unless rule #1 matches exactly.

FORMAT:

{
  "order_date": "YYYY-MM-DD" | null,
  "orders": [
    {
      "original_name": "string",
      "doc": number,
      "bird_type": "string|null"
    }
  ]
}
`;

            try {
                // Use the fallback mechanism which enforces json_object mode
                const aiResponse = await callAiWithFallback(groq, [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: aiInputText }
                ]);

                // Robust JSON Parsing
                let parsed: any = {};
                try {
                    parsed = JSON.parse(aiResponse || "{}");
                } catch (e) {
                    const jsonMatch = (aiResponse || "").match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsed = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error("No JSON object found in AI response");
                    }
                }

                const orderDate = parsed.order_date || null;
                let data = [];
                if (parsed.orders && Array.isArray(parsed.orders)) data = parsed.orders;
                else if (parsed.data && Array.isArray(parsed.data)) data = parsed.data;
                else if (Array.isArray(parsed)) data = parsed;
                else return { orderDate, items: [] };

                let lastSearchIndex = 0;
                const originalLines = baseCleanText.split("\n");

                const mappedData = data.map((item: any) => {
                    const rawName = item.original_name || item.name || "Unknown";
                    // Fallback cleanup: Remove serial numbers like "01.", "05." but keep IDs like "3014" (no dot)
                    const originalName = rawName.replace(/^\d+\.\s*/, "").trim();

                    // --- Metadata Rehydration ---
                    let extractedMobile = null;
                    let extractedLocation = null;

                    // Find where this name appears in the original text (starting from last found index)
                    // We use a loose check or normalizeName to find the line
                    let matchedLineIndex = -1;

                    const normalizedTarget = normalizeName(originalName);

                    for (let i = lastSearchIndex; i < originalLines.length; i++) {
                        const line = originalLines[i];
                        if (normalizeName(line).includes(normalizedTarget) && normalizedTarget.length > 3) { // >3 to avoid matching "Ali" in "Alim" maybe?
                            matchedLineIndex = i;
                            break;
                        }
                    }

                    if (matchedLineIndex !== -1) {
                        lastSearchIndex = matchedLineIndex + 1; // Start searching next item after this line

                        // Scan forward for Metadata until we hit a likely name (not perfect but heuristic) 
                        // OR until a reasonable limit (e.g. 10 lines)
                        // Actually, we just scan for Mobile/Loc regexes.
                        // We stop if we find a line that likely belongs to the NEXT item? 
                        // The user said "do not modify anything else", so we assume interleaved.
                        // We'll scan until we find a mobile or location.

                        for (let k = matchedLineIndex + 1; k < Math.min(matchedLineIndex + 8, originalLines.length); k++) {
                            const subLine = originalLines[k].trim();
                            if (!subLine) continue;

                            // Check Mobile
                            const mobileMatch = subLine.match(mobileRegex);
                            if (mobileMatch && !extractedMobile) {
                                // Clean up mobile (remove non-digits or keep as is? User said "Keep the data")
                                extractedMobile = mobileMatch[0];
                            }

                            // Check Location
                            const locMatch = subLine.match(locationRegex);
                            if (locMatch && !extractedLocation) {
                                // If regex captured group 1
                                extractedLocation = locMatch[1] || subLine.replace(/Loc(?:ation)?\s*[:.-]?/i, "").trim();
                            }
                        }
                    } else {
                        // Fallback: If not found sequentially, maybe reset search or just skip
                        // console.warn("Could not find line for rehydration:", originalName);
                    }


                    const { matchedId, matchedName, confidence, suggestions } = matchFarmer(originalName, candidates);

                    return {
                        name: originalName,
                        doc: Number(item.doc || item.quantity || item.amount) || 0,
                        birdType: item.birdType || item.bird_type || item.strain || null,
                        matchedId,
                        matchedName,
                        confidence,
                        suggestions,
                        location: extractedLocation || item.location || null, // Prioritize extracted
                        mobile: extractedMobile || item.mobile || null
                    };
                });

                return {
                    orderDate,
                    items: mappedData
                };

            } catch (e: any) {
                console.error("AI Extract Cycle Orders Failed:", e);
                return { orderDate: null, items: [] };
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
                // OFFICER-SPECIFIC SCAN: Access to own data or Admin override or Manager/Owner
                if (ctx.user.globalRole !== "ADMIN" && input.officerId !== ctx.user.id) {
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
                            message: "Analyzing another officer's data requires Manager or Owner privileges."
                        });
                    }
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

            // Performance Fix: Bulk query all recent mortality logs
            const cycleIds = activeCycles.map(c => c.cycleId);
            const allRecentLogs = await ctx.db.select()
                .from(cycleLogs)
                .where(and(
                    sql`${cycleLogs.cycleId} IN ${cycleIds} `,
                    eq(cycleLogs.type, "MORTALITY"),
                    gt(cycleLogs.createdAt, sql`NOW() - INTERVAL '3 DAYS'`)
                ))
                .orderBy(desc(cycleLogs.createdAt));

            // Group logs by cycle
            const logsByCycle = new Map<string, typeof allRecentLogs>();
            for (const log of allRecentLogs) {
                if (!logsByCycle.has(log.cycleId!)) logsByCycle.set(log.cycleId!, []);
                logsByCycle.get(log.cycleId!)!.push(log);
            }

            const riskFlags: { farmer: string; type: string; detail: string }[] = [];

            for (const cycle of activeCycles) {
                const recentLogs = logsByCycle.get(cycle.cycleId) || [];
                const recentMortalitySum = recentLogs.reduce((sum, log) => sum + log.valueChange, 0);
                const mortalityRate3Days = (recentMortalitySum / cycle.doc);

                if (mortalityRate3Days > 0.01) {
                    riskFlags.push({
                        farmer: cycle.farmerName,
                        type: "HIGH_MORTALITY",
                        detail: `Lost ${recentMortalitySum} birds(${(mortalityRate3Days * 100).toFixed(2)}%) in last 3 days.`
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
            // console.log("OFFICER:" + input.officerId)
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
                // OFFICER-SPECIFIC SCAN: Access to own data or Admin override or Manager/Owner
                if (ctx.user.globalRole !== "ADMIN" && input.officerId !== ctx.user.id) {
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
                            message: "Analyzing another officer's data requires Manager or Owner privileges."
                        });
                    }
                }
            }


            const rows = await ctx.db.select({
                farmerId: farmer.id,
                farmerName: farmer.name,
                mainStock: farmer.mainStock,
                cycleId: cycles.id,
                consumed: cycles.intake,
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
            // Group by Farmer
            const farmerData = new Map<string, {
                name: string,
                stock: number,
                cycles: Array<{ id: string, doc: number, age: number, intake: number }>
            }>();

            for (const row of rows) {
                if (!farmerData.has(row.farmerId)) {
                    farmerData.set(row.farmerId, {
                        name: row.farmerName,
                        stock: row.mainStock,
                        cycles: []
                    });
                }
                if (row.cycleId) {
                    farmerData.get(row.farmerId)!.cycles.push({
                        id: row.cycleId,
                        doc: row.doc!,
                        age: row.age!,
                        intake: row.consumed || 0
                    });
                }
            }

            const allCycleIds = rows.map(r => r.cycleId).filter(Boolean) as string[];

            // Performance Fix: Bulk query all recent feed logs
            const allRecentFeedLogs = allCycleIds.length > 0
                ? await ctx.db.select()
                    .from(cycleLogs)
                    .where(and(
                        sql`${cycleLogs.cycleId} IN ${allCycleIds}`,
                        eq(cycleLogs.type, "FEED"),
                        gt(cycleLogs.createdAt, sql`NOW() - INTERVAL '3 DAYS'`)
                    ))
                : [];

            const feedLogsByCycle = new Map<string, typeof allRecentFeedLogs>();
            for (const log of allRecentFeedLogs) {
                if (!feedLogsByCycle.has(log.cycleId!)) feedLogsByCycle.set(log.cycleId!, []);
                feedLogsByCycle.get(log.cycleId!)!.push(log);
            }

            const predictions: { farmerId: string; farmer: string; stock: number; burnRate: string; daysRemaining: string; urgency: "CRITICAL" | "HIGH" }[] = [];

            for (const [farmerId, data] of farmerData.entries()) {
                let totalDailyBurnRate = 0;
                let totalConsumedInActiveCycles = 0;

                // 1. Calculate combined burn rate and total intake for all active cycles
                for (const cycle of data.cycles) {
                    totalConsumedInActiveCycles += cycle.intake;

                    const recentFeedLogs = feedLogsByCycle.get(cycle.id) || [];

                    let cycleBurnRate = 0;
                    if (recentFeedLogs.length > 0) {
                        const totalRecentIntake = recentFeedLogs.reduce((sum, log) => sum + (log.valueChange || 0), 0);
                        cycleBurnRate = totalRecentIntake / 3;
                    }

                    if (cycleBurnRate === 0) {
                        const estimatedGramsPerBird = Math.min(180, Math.max(20, cycle.age * 5));
                        cycleBurnRate = (cycle.doc * estimatedGramsPerBird) / 50000; // 1000g/kg * 50kg/bag
                    }
                    totalDailyBurnRate += cycleBurnRate;
                }

                // 2. Calculate Actual Remaining Stock
                const actualRemainingStock = data.stock - totalConsumedInActiveCycles;

                // 3. Determine urgency and prediction
                // Fix: Properly handle zero/negative stock for daysRemaining
                let daysRemaining = 999;
                if (actualRemainingStock <= 0) {
                    daysRemaining = 0;
                } else if (totalDailyBurnRate > 0) {
                    daysRemaining = actualRemainingStock / totalDailyBurnRate;
                }

                // Logic Refinement: Risk is based purely on burn-rate (days remaining) 
                // OR actual negative/zero stock state.
                if (actualRemainingStock <= 0 || daysRemaining < 4) {
                    const urgency = (daysRemaining < 1.5 || actualRemainingStock <= 0) ? "CRITICAL" : "HIGH";
                    predictions.push({
                        farmerId,
                        farmer: data.name,
                        stock: actualRemainingStock,
                        burnRate: totalDailyBurnRate.toFixed(2),
                        daysRemaining: daysRemaining.toFixed(2),
                        urgency
                    });
                }
            }

            if (predictions.length === 0) {
                return { status: "OK", message: "Supply chain healthy. No immediate stockouts predicted.", predictions: [] };
            }

            return {
                status: "WARNING",
                message: "Stockout risks detected.",
                predictions: predictions.sort((a, b) => parseFloat(a.daysRemaining) - parseFloat(b.daysRemaining)),
                aiPlan: null
            };
        }),
});
