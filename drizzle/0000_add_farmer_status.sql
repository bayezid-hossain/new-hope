CREATE TYPE "public"."global_role" AS ENUM('ADMIN', 'USER');--> statement-breakpoint
CREATE TYPE "public"."log_type" AS ENUM('FEED', 'MORTALITY', 'NOTE', 'CORRECTION', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('PENDING', 'ACTIVE', 'REJECTED', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('INFO', 'WARNING', 'CRITICAL', 'SUCCESS', 'UPDATE');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('OWNER', 'MANAGER', 'OFFICER');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_history" (
	"id" text PRIMARY KEY NOT NULL,
	"cycle_name" text NOT NULL,
	"farmer_id" text NOT NULL,
	"organization_id" text,
	"doc" integer NOT NULL,
	"final_intake" real NOT NULL,
	"mortality" integer NOT NULL,
	"age" integer NOT NULL,
	"status" text DEFAULT 'archived' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"cycle_id" text,
	"history_id" text,
	"user_id" text NOT NULL,
	"type" "log_type" NOT NULL,
	"value_change" double precision NOT NULL,
	"previous_value" double precision,
	"new_value" double precision,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"farmer_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"doc" integer NOT NULL,
	"intake" real DEFAULT 0 NOT NULL,
	"mortality" integer DEFAULT 0 NOT NULL,
	"age" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farmer" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"main_stock" real NOT NULL,
	"total_consumed" real DEFAULT 0 NOT NULL,
	"officer_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"feature" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" "org_role" DEFAULT 'OFFICER' NOT NULL,
	"status" "member_status" DEFAULT 'PENDING' NOT NULL,
	"active_mode" text DEFAULT 'OFFICER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"details" text,
	"type" "notification_type" DEFAULT 'INFO' NOT NULL,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stock_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"farmer_id" text,
	"amount" numeric NOT NULL,
	"type" varchar(50) NOT NULL,
	"reference_id" varchar,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"active_mode" text DEFAULT 'USER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"global_role" "global_role" DEFAULT 'USER' NOT NULL,
	"is_pro" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_history" ADD CONSTRAINT "cycle_history_farmer_id_farmer_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_history" ADD CONSTRAINT "cycle_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_logs" ADD CONSTRAINT "cycle_logs_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_logs" ADD CONSTRAINT "cycle_logs_history_id_cycle_history_id_fk" FOREIGN KEY ("history_id") REFERENCES "public"."cycle_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_logs" ADD CONSTRAINT "cycle_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_farmer_id_farmer_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer" ADD CONSTRAINT "farmer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer" ADD CONSTRAINT "farmer_officer_id_user_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_request" ADD CONSTRAINT "feature_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_logs" ADD CONSTRAINT "stock_logs_farmer_id_farmer_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_history_org_id" ON "cycle_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_history_farmer_id" ON "cycle_history" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_logs_cycle_id" ON "cycle_logs" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "idx_logs_history_id" ON "cycle_logs" USING btree ("history_id");--> statement-breakpoint
CREATE INDEX "idx_cycles_org_id" ON "cycles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_cycles_farmer_id" ON "cycles" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_farmer_org_id" ON "farmer" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_farmer_officer_id" ON "farmer" USING btree ("officer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_farmer_name_per_officer_ci" ON "farmer" USING btree ("organization_id","officer_id","name");--> statement-breakpoint
CREATE INDEX "idx_feature_req_user" ON "feature_request" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_org_member" ON "member" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_member_org_id" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_member_user_id" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_user" ON "notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_org" ON "notification" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_notification_created" ON "notification" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_stock_logs_farmer_id" ON "stock_logs" USING btree ("farmer_id");