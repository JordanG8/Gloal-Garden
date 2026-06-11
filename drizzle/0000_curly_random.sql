CREATE TABLE "adoptions" (
	"user_id" integer NOT NULL,
	"plant_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "adoptions_user_id_plant_id_pk" PRIMARY KEY("user_id","plant_id")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" integer NOT NULL,
	"following_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_following_id_pk" PRIMARY KEY("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"payload" json,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"photo_url" text,
	"caption" text,
	"harvest_quantity" text,
	"disease_tag" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" serial PRIMARY KEY NOT NULL,
	"species_id" integer NOT NULL,
	"nickname" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"planted_at" timestamp DEFAULT now() NOT NULL,
	"planted_by" integer NOT NULL,
	"status" text DEFAULT 'growing' NOT NULL,
	"last_watered_at" timestamp,
	"last_checked_at" timestamp,
	"expected_harvest_at" timestamp,
	"description" text,
	"access_notes" text,
	"visibility" text DEFAULT 'public' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "species" (
	"id" serial PRIMARY KEY NOT NULL,
	"common_name" text NOT NULL,
	"scientific_name" text NOT NULL,
	"category" text NOT NULL,
	"emoji" text DEFAULT '🌱' NOT NULL,
	"growing_season_start" integer,
	"growing_season_end" integer,
	"days_to_harvest" integer,
	"watering_frequency_days" integer NOT NULL,
	"sun_requirements" text,
	"soil_notes" text,
	"hardiness_zones" text,
	"companion_plants" text,
	"care_guide_markdown" text,
	"hero_image_url" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar" text,
	"bio" text,
	"location" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"stats" json DEFAULT '{"plantsAdded":0,"photosContributed":0,"careActions":0,"harvestsLogged":0}'::json,
	"badges" json DEFAULT '[]'::json,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_planted_by_users_id_fk" FOREIGN KEY ("planted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;