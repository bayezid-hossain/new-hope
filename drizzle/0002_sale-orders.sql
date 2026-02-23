CREATE TYPE "public"."doc_order_status" AS ENUM('PENDING', 'CONFIRMED');--> statement-breakpoint
CREATE TYPE "public"."feed_order_status" AS ENUM('PENDING', 'CONFIRMED');--> statement-breakpoint
ALTER TYPE "public"."log_type" ADD VALUE 'SALES';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'SALES';--> statement-breakpoint
CREATE TABLE "bird_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bird_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "doc_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"doc_order_id" text NOT NULL,
	"farmer_id" text NOT NULL,
	"bird_type" text NOT NULL,
	"doc_count" integer NOT NULL,
	"is_contract" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"officer_id" text NOT NULL,
	"order_date" timestamp NOT NULL,
	"status" "doc_order_status" DEFAULT 'PENDING' NOT NULL,
	"branch_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_order_id" text NOT NULL,
	"farmer_id" text NOT NULL,
	"feed_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"officer_id" text NOT NULL,
	"order_date" timestamp NOT NULL,
	"delivery_date" timestamp NOT NULL,
	"status" "feed_order_status" DEFAULT 'PENDING' NOT NULL,
	"driver_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_events" (
	"id" text PRIMARY KEY NOT NULL,
	"cycle_id" text,
	"history_id" text,
	"location" text NOT NULL,
	"party" text,
	"sale_date" timestamp DEFAULT now() NOT NULL,
	"house_birds" integer NOT NULL,
	"birds_sold" integer NOT NULL,
	"total_mortality" integer NOT NULL,
	"total_weight" numeric NOT NULL,
	"avg_weight" numeric NOT NULL,
	"price_per_kg" numeric NOT NULL,
	"total_amount" numeric NOT NULL,
	"cash_received" numeric DEFAULT '0',
	"deposit_received" numeric DEFAULT '0',
	"feed_consumed" text NOT NULL,
	"feed_stock" text NOT NULL,
	"medicine_cost" numeric DEFAULT '0',
	"selected_report_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"cycle_id" text,
	"history_id" text,
	"fcr" numeric(10, 2) NOT NULL,
	"epi" numeric(10, 2) NOT NULL,
	"survival_rate" numeric(5, 2) NOT NULL,
	"average_weight" numeric(10, 3) NOT NULL,
	"total_birds_sold" integer NOT NULL,
	"total_doc" integer NOT NULL,
	"total_mortality" integer NOT NULL,
	"average_age" numeric(5, 2) NOT NULL,
	"doc_cost" numeric NOT NULL,
	"feed_cost" numeric NOT NULL,
	"medicine_cost" numeric NOT NULL,
	"total_revenue" numeric NOT NULL,
	"net_profit" numeric NOT NULL,
	"feed_price_used" numeric DEFAULT '3220' NOT NULL,
	"doc_price_used" numeric DEFAULT '41.5' NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"last_recalculated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_cycle_metrics" UNIQUE("cycle_id"),
	CONSTRAINT "unique_history_metrics" UNIQUE("history_id")
);
--> statement-breakpoint
CREATE TABLE "sale_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_order_id" text NOT NULL,
	"farmer_id" text NOT NULL,
	"total_weight" real DEFAULT 0 NOT NULL,
	"total_doc" integer DEFAULT 0 NOT NULL,
	"avg_weight" text,
	"age" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"officer_id" text NOT NULL,
	"order_date" timestamp NOT NULL,
	"branch_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_event_id" text NOT NULL,
	"birds_sold" integer NOT NULL,
	"total_mortality" integer DEFAULT 0,
	"total_weight" numeric NOT NULL,
	"price_per_kg" numeric NOT NULL,
	"total_amount" numeric NOT NULL,
	"avg_weight" numeric NOT NULL,
	"cash_received" numeric DEFAULT '0',
	"deposit_received" numeric DEFAULT '0',
	"medicine_cost" numeric DEFAULT '0',
	"adjustment_note" text,
	"feed_consumed" text,
	"feed_stock" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cycle_history" ADD COLUMN "birds_sold" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cycle_history" ADD COLUMN "bird_type" text;--> statement-breakpoint
ALTER TABLE "cycle_logs" ADD COLUMN "is_reverted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "birds_sold" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "bird_type" text;--> statement-breakpoint
ALTER TABLE "farmer" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "farmer" ADD COLUMN "mobile" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "access_level" text DEFAULT 'VIEW' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "feed_price_per_bag" numeric DEFAULT '3220';--> statement-breakpoint
ALTER TABLE "stock_logs" ADD COLUMN "driver_name" text;--> statement-breakpoint
ALTER TABLE "doc_order_items" ADD CONSTRAINT "doc_order_items_doc_order_id_doc_orders_id_fk" FOREIGN KEY ("doc_order_id") REFERENCES "public"."doc_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_order_items" ADD CONSTRAINT "doc_order_items_farmer_id_farmer_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_orders" ADD CONSTRAINT "doc_orders_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_orders" ADD CONSTRAINT "doc_orders_officer_id_user_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_order_items" ADD CONSTRAINT "feed_order_items_feed_order_id_feed_orders_id_fk" FOREIGN KEY ("feed_order_id") REFERENCES "public"."feed_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_order_items" ADD CONSTRAINT "feed_order_items_farmer_id_farmer_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_orders" ADD CONSTRAINT "feed_orders_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_orders" ADD CONSTRAINT "feed_orders_officer_id_user_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_events" ADD CONSTRAINT "sale_events_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_events" ADD CONSTRAINT "sale_events_history_id_cycle_history_id_fk" FOREIGN KEY ("history_id") REFERENCES "public"."cycle_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_events" ADD CONSTRAINT "sale_events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_metrics" ADD CONSTRAINT "sale_metrics_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_metrics" ADD CONSTRAINT "sale_metrics_history_id_cycle_history_id_fk" FOREIGN KEY ("history_id") REFERENCES "public"."cycle_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_order_items" ADD CONSTRAINT "sale_order_items_sale_order_id_sale_orders_id_fk" FOREIGN KEY ("sale_order_id") REFERENCES "public"."sale_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_order_items" ADD CONSTRAINT "sale_order_items_farmer_id_farmer_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_officer_id_user_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_reports" ADD CONSTRAINT "sale_reports_sale_event_id_sale_events_id_fk" FOREIGN KEY ("sale_event_id") REFERENCES "public"."sale_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_reports" ADD CONSTRAINT "sale_reports_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_doc_order_item_order" ON "doc_order_items" USING btree ("doc_order_id");--> statement-breakpoint
CREATE INDEX "idx_doc_order_org" ON "doc_orders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_doc_order_officer" ON "doc_orders" USING btree ("officer_id");--> statement-breakpoint
CREATE INDEX "idx_feed_order_item_order" ON "feed_order_items" USING btree ("feed_order_id");--> statement-breakpoint
CREATE INDEX "idx_feed_order_org" ON "feed_orders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_feed_order_officer" ON "feed_orders" USING btree ("officer_id");--> statement-breakpoint
CREATE INDEX "idx_sale_events_cycle_id" ON "sale_events" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "idx_sale_events_history_id" ON "sale_events" USING btree ("history_id");--> statement-breakpoint
CREATE INDEX "idx_sale_metrics_cycle" ON "sale_metrics" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "idx_sale_metrics_history" ON "sale_metrics" USING btree ("history_id");--> statement-breakpoint
CREATE INDEX "idx_sale_order_item_order" ON "sale_order_items" USING btree ("sale_order_id");--> statement-breakpoint
CREATE INDEX "idx_sale_order_org" ON "sale_orders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_sale_order_officer" ON "sale_orders" USING btree ("officer_id");--> statement-breakpoint
CREATE INDEX "idx_sale_reports_event_id" ON "sale_reports" USING btree ("sale_event_id");