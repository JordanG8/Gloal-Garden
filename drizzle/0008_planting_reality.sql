ALTER TABLE "plants" ADD COLUMN "origin" text DEFAULT 'planted_by_me' NOT NULL;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "planted_at_precision" text DEFAULT 'day' NOT NULL;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "care_mode" text DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "water_interval_summer_days" integer;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "water_interval_winter_days" integer;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "water_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "is_perennial" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "harvest_month_start" integer;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "harvest_month_end" integer;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "years_to_first_harvest" integer;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "water_interval_summer_days" integer;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "water_interval_winter_days" integer;--> statement-breakpoint
CREATE INDEX "plants_water_due_idx" ON "plants" USING btree ("water_due_at") WHERE water_due_at is not null;