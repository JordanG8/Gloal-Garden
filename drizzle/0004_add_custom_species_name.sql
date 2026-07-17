ALTER TABLE "plants" ADD COLUMN "custom_species_name" text;
--> statement-breakpoint
-- Generic species row FK target for "Other — name it yourself" plants.
-- scientific_name '__custom__' is the sentinel the app looks up at runtime.
INSERT INTO "species" ("common_name", "scientific_name", "category", "emoji", "watering_frequency_days")
SELECT 'Custom Plant', '__custom__', 'other', '🌱', 7
WHERE NOT EXISTS (SELECT 1 FROM "species" WHERE "scientific_name" = '__custom__');