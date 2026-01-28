
import Groq from "groq-sdk";
import { z } from "zod";
import { createTRPCRouter, officerProcedure } from "../../init";

export const officerAiRouter = createTRPCRouter({
    extractFarmers: officerProcedure
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
            You are an intelligent data extraction and matching engine for a feed distribution system.
            
            Goal:
            1. Extract farmer names and their TOTAL feed bag count (Sum of B1 + B2 + etc) from the input text.
            2. Match each extracted name against the provided CANDIDATE LIST.
            
            CANDIDATE LIST:
            ${candidatesList}
            
            Rules:
            1. Return ONLY a valid JSON array. No markdown, no explanations.
            2. Structure: 
               [
                 {
                   "original_name": "string (name found in text)",
                   "amount": number (sum of bags),
                   "matched_id": "string | null (ID from candidate list)",
                   "confidence": "HIGH" | "MEDIUM" | "LOW",
                   "suggestions": [ { "id": "string", "name": "string" } ] (Top 3 likely matches if confidence is not HIGH)
                 }
               ]
            3. Matching Logic:
               - "HIGH": Exact match or very close typo (e.g. "Raby Trders" -> "Rabby Traders").
               - "MEDIUM": Partial match or significant typo but likely (e.g. "Abdul" -> "Abdul Hamid" if unique).
               - "LOW": Weak match.
               - If no match found, set "matched_id": null.
               - ALWAYS provide "suggestions" if "matched_id" is null or "confidence" is LOW.
            4. "amount" must be the integer SUM of all bags mentioned for that farmer.
            5. Ignore unrelated text (dates, locations).
            `;

            console.log("AI Input Text Length:", input.text.length);
            console.log("Candidates Count:", input.candidates.length);

            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: input.text }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0,
                // response_format: { type: "json_object" } // Sometimes causes issues if model chats
            });

            const content = completion.choices[0]?.message?.content || "[]";
            console.log("AI Raw Output:", content);

            console.log("AI Raw Output:", content);

            // Clean up code blocks if present
            const jsonString = content.replace(/```json\n?|\n?```/g, "").trim();

            try {
                const parsed = JSON.parse(jsonString);
                // Normalization
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

            } catch (e) {
                console.error("Failed to parse Groq response:", content);
                throw new Error("Failed to parse AI response. " + content.substring(0, 50));
            }
        }),
});
