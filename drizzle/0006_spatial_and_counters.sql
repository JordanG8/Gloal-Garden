ALTER TABLE "plants" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "latest_photo_url" text;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "photo_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "geo" "point" GENERATED ALWAYS AS (point(lng, lat)) STORED;--> statement-breakpoint
CREATE INDEX "plants_geo_gist_idx" ON "plants" USING gist ("geo");--> statement-breakpoint
-- Backfill the counters this migration just added, so existing plants keep
-- their photos on the map. New writes maintain them in plant-actions.ts.
UPDATE "plants" p SET
  "latest_photo_url" = (
    SELECT o.photo_url FROM observations o
    WHERE o.plant_id = p.id AND o.photo_url IS NOT NULL
    ORDER BY o.created_at DESC, o.id DESC LIMIT 1
  ),
  "photo_count" = (
    SELECT count(*) FROM observations o
    WHERE o.plant_id = p.id AND o.photo_url IS NOT NULL
  );
