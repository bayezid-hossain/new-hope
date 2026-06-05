CREATE TABLE "price_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"feed_price_per_bag" numeric NOT NULL,
	"doc_price_per_bird" numeric NOT NULL,
	"base_sell_price" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_price_policies_org_effective" UNIQUE("organization_id","effective_from")
);
--> statement-breakpoint
ALTER TABLE "price_policies" ADD CONSTRAINT "price_policies_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_price_policies_org_id" ON "price_policies" USING btree ("organization_id");

-- Seed historical price policy (all cycles before 2026-06-05 used these prices)
INSERT INTO "price_policies" ("id", "organization_id", "effective_from", "feed_price_per_bag", "doc_price_per_bird", "base_sell_price", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", '2000-01-01 00:00:00+00', '3220', '41.5', '141', now(), now()
FROM "organization";

-- Seed current price policy (effective from 2026-06-05)
INSERT INTO "price_policies" ("id", "organization_id", "effective_from", "feed_price_per_bag", "doc_price_per_bird", "base_sell_price", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", '2026-06-05 00:00:00+00', '3325', '41.5', '145', now(), now()
FROM "organization";