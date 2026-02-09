import { z } from "zod";

// Regex helper: Allows a-z, A-Z, 0-9 and Spaces
const alphanumericRegex = /^[a-zA-Z0-9\s]+$/;

export const addFeedSchema = z.object({
  // Numbers are already strict (cannot contain letters), so no regex needed here
  amount: z.number().min(1, "Amount must be at least 1"),
  note: z.string().optional(),
});
export const addMortalitySchema = z.object({
  id: z.string(),
  amount: z.number().int().min(1, "Mortality must be at least 1"),
  reason: z.string().optional(),
});
export const farmerInsertSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .regex(alphanumericRegex, "Only English letters and numbers are allowed"),

  doc: z.number()
    .min(1, "Doc is required")
  ,

  inputFeed: z.number().min(0, "Input feed must be a positive number"),
  age: z.number().min(1, "Age must be at least 1").max(40, "Age cannot exceed 40"),
});

export const farmerSearchSchema = z.object({
  page: z.number().default(1),
  pageSize: z.number().default(10),

  search: z.string()
    .optional()
    // We modify the refine/regex check to allow undefined (empty search)
    // If search exists, it must match the regex
    .refine((val) => !val || alphanumericRegex.test(val), {
      message: "Search can only contain English letters and numbers",
    }),

  status: z.enum(["active", "history"]).default("active"),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});