CREATE TABLE "farmer_security_money_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"farmer_id" text NOT NULL,
	"previous_amount" numeric NOT NULL,
	"new_amount" numeric NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
DROP INDEX "unique_farmer_name_per_officer_ci";--> statement-breakpoint
ALTER TABLE "farmer" ADD COLUMN "security_money" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "pro_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "farmer_security_money_logs" ADD CONSTRAINT "farmer_security_money_logs_farmer_id_farmer_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer_security_money_logs" ADD CONSTRAINT "farmer_security_money_logs_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_security_logs_farmer_id" ON "farmer_security_money_logs" USING btree ("farmer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_farmer_name_per_officer_ci" ON "farmer" USING btree ("organization_id","officer_id","name") WHERE status = 'active';