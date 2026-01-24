import { cycleHistory, cycles } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";

export type Farmer = InferSelectModel<typeof cycles> & { farmerName: string };
export type FarmerHistory = InferSelectModel<typeof cycleHistory>; 