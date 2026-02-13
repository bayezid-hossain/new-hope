import { cycleHistory, cycles } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";

export type Farmer = InferSelectModel<typeof cycles> & { farmerName: string; officerName?: string | null; farmerLocation?: string | null; farmerMobile?: string | null };
export type FarmerHistory = InferSelectModel<typeof cycleHistory> & { officerName?: string | null }; 