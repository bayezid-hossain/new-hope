import { farmer } from "@/db/schema";
import { SQL, sql } from "drizzle-orm";

/**
 * farmer.mainStock is a `real` (float4) column, which only carries ~7 significant
 * decimal digits. Left unrounded, repeated `mainStock + delta` updates accumulate
 * floating-point drift over hundreds of transactions (e.g. an exact 1 bag ends up
 * stored as 0.9999786). Rounding to 2 decimal places on every write resets that
 * drift instead of letting it compound.
 */
export const roundedMainStock = (delta: number | SQL) => sql`ROUND((${farmer.mainStock} + ${delta})::numeric, 2)`;
