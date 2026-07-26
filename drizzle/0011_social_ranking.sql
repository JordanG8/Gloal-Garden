-- Ranking and vote bookkeeping for the community feed.
--
-- `hot_rank` is a STORED generated column, not something a cron recomputes.
-- Reddit's formula is time-monotone: an existing post's rank only changes when
-- its score does, and Postgres maintains that itself. This removes the whole
-- "forgot to recompute" bug class, and it is why `posts.created_at` being
-- `timestamp` (not `timestamptz`) matters — it makes extract(epoch ...)
-- IMMUTABLE, which a generated column requires.
--
-- double precision rather than real: epoch/45000 is ~39000 today, and real's
-- ~6 significant digits would give every post made in the same hour an
-- identical rank.
ALTER TABLE "posts" ADD COLUMN "hot_rank" double precision
  GENERATED ALWAYS AS (
    log(greatest(abs(score), 1)) + sign(score) * extract(epoch from created_at) / 45000
  ) STORED;
--> statement-breakpoint

-- The feed's only ordering index. The WHERE clause must be repeated verbatim
-- by every read or the planner won't use it — see listZonePosts in social-data.ts.
CREATE INDEX "posts_zone_hot_idx" ON "posts" ("zone_id", "hot_rank" DESC)
  WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX "posts_zone_top_idx" ON "posts" ("zone_id", "score" DESC)
  WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX "comments_tree_idx" ON "comments" ("post_id", "created_at", "id")
  WHERE deleted_at IS NULL;
--> statement-breakpoint

-- Scores are maintained by trigger rather than by the action that writes the
-- vote. The action could do it in one runBatch and be correct, but a trigger
-- stays correct for writers that don't go through the action — the seed
-- script, a backfill, a future moderation tool.
CREATE OR REPLACE FUNCTION bump_post_score() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET score = score + NEW.value WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE posts SET score = score - OLD.value + NEW.value WHERE id = NEW.post_id;
  ELSE
    UPDATE posts SET score = score - OLD.value WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER post_votes_score
AFTER INSERT OR UPDATE OR DELETE ON post_votes
FOR EACH ROW EXECUTE FUNCTION bump_post_score();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION bump_comment_score() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET score = score + NEW.value WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE comments SET score = score - OLD.value + NEW.value WHERE id = NEW.comment_id;
  ELSE
    UPDATE comments SET score = score - OLD.value WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER comment_votes_score
AFTER INSERT OR UPDATE OR DELETE ON comment_votes
FOR EACH ROW EXECUTE FUNCTION bump_comment_score();
--> statement-breakpoint

-- Comment counts, for the same reason.
CREATE OR REPLACE FUNCTION bump_post_comment_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = greatest(comment_count - 1, 0) WHERE id = OLD.post_id;
  -- A soft delete leaves the row in the tree (so replies keep their parent)
  -- but should stop counting towards the total.
  ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE posts SET comment_count = greatest(comment_count - 1, 0) WHERE id = NEW.post_id;
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER comments_count
AFTER INSERT OR UPDATE OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION bump_post_comment_count();
--> statement-breakpoint

-- Zone post counts, so a zone directory doesn't COUNT(*) per row.
CREATE OR REPLACE FUNCTION bump_zone_post_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE zones SET post_count = post_count + 1 WHERE id = NEW.zone_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE zones SET post_count = greatest(post_count - 1, 0) WHERE id = OLD.zone_id;
  ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE zones SET post_count = greatest(post_count - 1, 0) WHERE id = NEW.zone_id;
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE zones SET post_count = post_count + 1 WHERE id = NEW.zone_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER posts_zone_count
AFTER INSERT OR UPDATE OR DELETE ON posts
FOR EACH ROW EXECUTE FUNCTION bump_zone_post_count();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION bump_zone_member_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE zones SET member_count = member_count + 1 WHERE id = NEW.zone_id;
  ELSE
    UPDATE zones SET member_count = greatest(member_count - 1, 0) WHERE id = OLD.zone_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER zone_members_count
AFTER INSERT OR DELETE ON zone_members
FOR EACH ROW EXECUTE FUNCTION bump_zone_member_count();
