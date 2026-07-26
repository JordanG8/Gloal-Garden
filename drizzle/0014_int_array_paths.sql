-- json -> integer[] for the two ancestry columns.
--
-- `json` has no ordering operator in Postgres at all, so ordering a comment
-- tree by `path` requires casting to text — and text ordering puts [10] before
-- [9], silently scrambling any thread that reaches double-digit comment ids.
-- Integer arrays compare element-wise and numerically, which is exactly tree
-- order, and they support GIN containment for the zone hierarchy.
--
-- The conversion is a pure text transform rather than the obvious
-- json_array_elements aggregate, because Postgres rejects subqueries in an
-- ALTER ... USING clause ("cannot use subquery in transform expression").
-- A json int array renders as '[1, 2, 7]'; swapping the brackets for braces
-- gives '{1, 2, 7}', which casts straight to integer[]. '[]' becomes '{}'.

ALTER TABLE "comments" ALTER COLUMN "path" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "comments"
  ALTER COLUMN "path" SET DATA TYPE integer[]
  USING translate("path"::text, '[]', '{}')::integer[];--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "path" SET DEFAULT '{}';--> statement-breakpoint

ALTER TABLE "zones" ALTER COLUMN "ancestor_ids" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "zones"
  ALTER COLUMN "ancestor_ids" SET DATA TYPE integer[]
  USING translate("ancestor_ids"::text, '[]', '{}')::integer[];--> statement-breakpoint
ALTER TABLE "zones" ALTER COLUMN "ancestor_ids" SET DEFAULT '{}';--> statement-breakpoint

CREATE INDEX "comments_path_idx" ON "comments" USING btree ("post_id","path");--> statement-breakpoint
CREATE INDEX "zones_ancestors_idx" ON "zones" USING gin ("ancestor_ids");
