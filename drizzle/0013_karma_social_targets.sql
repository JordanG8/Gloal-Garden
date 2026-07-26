ALTER TABLE "karma_events" ADD COLUMN "post_id" integer;--> statement-breakpoint
ALTER TABLE "karma_events" ADD COLUMN "comment_id" integer;--> statement-breakpoint
ALTER TABLE "karma_events" ADD CONSTRAINT "karma_events_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karma_events" ADD CONSTRAINT "karma_events_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "karma_events_once_per_post_idx" ON "karma_events" USING btree ("post_id","kind") WHERE "karma_events"."post_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "karma_events_once_per_comment_idx" ON "karma_events" USING btree ("comment_id","kind") WHERE "karma_events"."comment_id" is not null;