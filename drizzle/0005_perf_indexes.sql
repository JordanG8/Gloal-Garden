CREATE INDEX "adoptions_plant_idx" ON "adoptions" USING btree ("plant_id");--> statement-breakpoint
CREATE INDEX "karma_events_observation_idx" ON "karma_events" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "observations_plant_created_idx" ON "observations" USING btree ("plant_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "observations_user_plant_idx" ON "observations" USING btree ("user_id","plant_id");--> statement-breakpoint
CREATE INDEX "observations_plant_photo_idx" ON "observations" USING btree ("plant_id","created_at" DESC NULLS LAST) WHERE photo_url is not null;--> statement-breakpoint
CREATE INDEX "plants_planted_by_idx" ON "plants" USING btree ("planted_by");--> statement-breakpoint
CREATE INDEX "plants_species_idx" ON "plants" USING btree ("species_id");