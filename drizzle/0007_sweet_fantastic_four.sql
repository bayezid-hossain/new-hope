ALTER TABLE "organization" ALTER COLUMN "feed_price_per_bag" SET DEFAULT '3325';--> statement-breakpoint
ALTER TABLE "cycle_history" ADD COLUMN "official_input_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "official_input_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "doc_price_per_bird" numeric DEFAULT '41.5';--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "base_sell_price" numeric DEFAULT '145';--> statement-breakpoint
ALTER TABLE "sale_events" ADD COLUMN "birds_rejected" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_reports" ADD COLUMN "birds_rejected" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_reports" ADD COLUMN "party" text;--> statement-breakpoint
ALTER TABLE "sale_reports" ADD COLUMN "sale_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sale_reports" ADD COLUMN "official_input_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_logs" ADD COLUMN "balance_after" numeric;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "branch_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "mobile" text;

-- Update existing orgs still on old default (don't touch custom-priced orgs)
UPDATE "organization" SET "feed_price_per_bag" = '3325' WHERE "feed_price_per_bag" = '3220';
UPDATE "organization" SET "doc_price_per_bird" = '41.5' WHERE "doc_price_per_bird" IS NULL;
UPDATE "organization" SET "base_sell_price" = '145' WHERE "base_sell_price" IS NULL;

-- Backfill null recovery_price in saleMetrics so adjust-sale modal gets correct historical price
UPDATE "sale_metrics" SET "recovery_price" = '141' WHERE "recovery_price" IS NULL;