CREATE TABLE "karma_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plant_id" integer,
	"observation_id" integer,
	"kind" text NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "karma" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "karma_events" ADD CONSTRAINT "karma_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karma_events" ADD CONSTRAINT "karma_events_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karma_events" ADD CONSTRAINT "karma_events_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "karma_events_user_created_idx" ON "karma_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "karma_events_plant_kind_idx" ON "karma_events" USING btree ("plant_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "karma_events_once_per_plant_idx" ON "karma_events" USING btree ("plant_id","kind") WHERE "karma_events"."kind" in ('plant_established', 'plant_first_harvest');--> statement-breakpoint
CREATE INDEX "users_karma_idx" ON "users" USING btree ("karma");