CREATE TABLE "garden_members" (
	"garden_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "garden_members_garden_id_user_id_pk" PRIMARY KEY("garden_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "gardens" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'patch' NOT NULL,
	"description" text,
	"owner_id" integer NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"geo" "point" GENERATED ALWAYS AS (point(lng, lat)) STORED,
	"radius_m" integer DEFAULT 25 NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"plant_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gardens_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "garden_id" integer;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "bed_label" text;--> statement-breakpoint
ALTER TABLE "garden_members" ADD CONSTRAINT "garden_members_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_members" ADD CONSTRAINT "garden_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gardens" ADD CONSTRAINT "gardens_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garden_members_user_idx" ON "garden_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gardens_owner_idx" ON "gardens" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "gardens_geo_gist_idx" ON "gardens" USING gist ("geo");--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plants_garden_bed_idx" ON "plants" USING btree ("garden_id","bed_label");