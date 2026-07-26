ALTER TABLE "plants" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "latest_photo_url" text;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "photo_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "geo" "point" GENERATED ALWAYS AS (point(lng, lat)) STORED;--> statement-breakpoint
CREATE INDEX "plants_geo_gist_idx" ON "plants" USING gist ("geo");