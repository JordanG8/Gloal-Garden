'use server';

import { db, runBatch, type BatchItem } from '@/db';
import {
  commentVotes,
  comments,
  karmaEvents,
  postReports,
  postVotes,
  posts,
  users,
  zoneMembers,
  zones,
} from '@/db/schema';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { emailVerificationBlocker, requireUserId } from './auth-helpers';
import { isValidPhotoUrl } from './photo-url';
import { resolveZoneId } from './zones';
import {
  COMMENT_SCORE_AWARDS,
  POST_SCORE_AWARDS,
  POINTS,
  canModerateZone,
  commentsPerHourFor,
  postsPerHourFor,
  socialAward,
} from './karma';
import { isPostKind, MAX_COMMENT_BODY, MAX_POST_BODY, MAX_POST_TITLE } from './social-kinds';
import type { ActionResult } from './types';

/**
 * Posts, comments, votes and moderation.
 *
 * Same conventions as plant-actions.ts throughout: machine-key errors resolved
 * client-side by actionMsg, multi-statement writes through runBatch (the Neon
 * HTTP driver has no interactive transactions), and every counter maintained
 * with atomic SQL or a database trigger rather than read-modify-write.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Nesting deeper than this is unreadable in a 520px column. */
const MAX_COMMENT_DEPTH = 8;

async function actorState(userId: number, now: Date) {
  const [user] = await db
    .select({ karma: users.karma, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const [earned] = await db
    .select({ total: sql<number>`coalesce(sum(${karmaEvents.points}), 0)::int` })
    .from(karmaEvents)
    .where(
      and(eq(karmaEvents.userId, userId), gt(karmaEvents.createdAt, new Date(now.getTime() - DAY_MS)))
    );

  return { karma: user.karma, createdAt: user.createdAt, earnedLast24h: earned?.total ?? 0 };
}

/**
 * Pays a threshold award at most once for a given target, using the same
 * insert-then-check trick as the founder bonuses: the partial unique index on
 * karma_events makes the "already paid?" question race-proof without a lock.
 */
async function payOnce(
  kind: string,
  target: { postId?: number; commentId?: number },
  userId: number,
  points: number
): Promise<boolean> {
  const marker = target.postId
    ? sql`${karmaEvents.kind} = ${kind} and ${karmaEvents.postId} = ${target.postId}`
    : sql`${karmaEvents.kind} = ${kind} and ${karmaEvents.commentId} = ${target.commentId}`;

  const [existing] = await db.select({ id: karmaEvents.id }).from(karmaEvents).where(marker).limit(1);
  if (existing) return false;

  await runBatch([
    db.insert(karmaEvents).values({
      userId,
      postId: target.postId ?? null,
      commentId: target.commentId ?? null,
      kind,
      points,
    }),
    db.update(users).set({ karma: sql`${users.karma} + ${points}` }).where(eq(users.id, userId)),
  ]);
  return true;
}

/** Have they written too much, too fast? */
async function overRateLimit(
  table: 'posts' | 'comments',
  userId: number,
  karma: number,
  now: Date
): Promise<boolean> {
  const since = new Date(now.getTime() - HOUR_MS);
  const [row] =
    table === 'posts'
      ? await db
          .select({ n: sql<number>`count(*)::int` })
          .from(posts)
          .where(and(eq(posts.authorId, userId), gt(posts.createdAt, since)))
      : await db
          .select({ n: sql<number>`count(*)::int` })
          .from(comments)
          .where(and(eq(comments.authorId, userId), gt(comments.createdAt, since)));

  const limit = table === 'posts' ? postsPerHourFor(karma) : commentsPerHourFor(karma);
  return (row?.n ?? 0) >= limit;
}

export async function createPost(input: {
  title: string;
  body?: string;
  kind: string;
  photoUrl?: string;
  plantId?: number;
  gardenId?: number;
  /** Explicit zone, or a point to resolve one from. */
  zoneId?: number;
  lat?: number;
  lng?: number;
}): Promise<ActionResult & { postId?: number; zoneSlug?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };
  const verificationError = await emailVerificationBlocker(userId);
  if (verificationError) return { ok: false, error: verificationError };

  const title = input.title.trim().slice(0, MAX_POST_TITLE);
  if (!title) return { ok: false, error: 'error_post_title' };
  if (!isValidPhotoUrl(input.photoUrl)) return { ok: false, error: 'error_photo' };

  const now = new Date();
  const actor = await actorState(userId, now);
  if (!actor) return { ok: false, error: 'error_signed_out' };
  if (await overRateLimit('posts', userId, actor.karma, now)) {
    return { ok: false, error: 'error_rate_limit' };
  }

  // A post has to land somewhere. An explicit zone wins; otherwise resolve the
  // point, which lazily creates a grid cell if no seeded zone covers it.
  let zoneId = input.zoneId ?? null;
  if (zoneId === null && Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
    zoneId = await resolveZoneId(input.lat!, input.lng!);
  }
  if (zoneId === null) return { ok: false, error: 'error_no_zone' };

  try {
    const [post] = await db
      .insert(posts)
      .values({
        zoneId,
        authorId: userId,
        kind: isPostKind(input.kind) ? input.kind : 'discussion',
        title,
        body: input.body?.trim().slice(0, MAX_POST_BODY) || null,
        photoUrl: input.photoUrl?.trim() || null,
        plantId: input.plantId ?? null,
        gardenId: input.gardenId ?? null,
      })
      .returning({ id: posts.id });

    // Posting itself pays nothing (POINTS.postCreated is 0) — the ledger row
    // exists as honest history, exactly like a filed report.
    const award = socialAward({
      kind: 'post_created',
      basePoints: POINTS.postCreated,
      earnedLast24h: actor.earnedLast24h,
      accountCreatedAt: actor.createdAt,
      currentKarma: actor.karma,
      now,
    });
    await db
      .insert(karmaEvents)
      .values({ userId, postId: post.id, kind: award.kind, points: award.points });

    // Writing in a zone joins it — you shouldn't have to press two buttons to
    // take part in your own neighbourhood.
    await db
      .insert(zoneMembers)
      .values({ zoneId, userId, role: 'member' })
      .onConflictDoNothing();

    const [zone] = await db
      .select({ slug: zones.slug })
      .from(zones)
      .where(eq(zones.id, zoneId))
      .limit(1);

    revalidatePath('/[locale]/(tabs)/community', 'page');
    revalidatePath('/[locale]/z/[slug]', 'page');
    return { ok: true, postId: post.id, zoneSlug: zone?.slug };
  } catch (error) {
    console.error('createPost failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}

export async function addComment(input: {
  postId: number;
  body: string;
  parentId?: number;
}): Promise<ActionResult & { commentId?: number }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };
  const verificationError = await emailVerificationBlocker(userId);
  if (verificationError) return { ok: false, error: verificationError };

  const body = input.body.trim().slice(0, MAX_COMMENT_BODY);
  if (!body) return { ok: false, error: 'error_comment_body' };

  const now = new Date();
  const actor = await actorState(userId, now);
  if (!actor) return { ok: false, error: 'error_signed_out' };
  if (await overRateLimit('comments', userId, actor.karma, now)) {
    return { ok: false, error: 'error_rate_limit' };
  }

  try {
    const [post] = await db
      .select({ id: posts.id, deletedAt: posts.deletedAt })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .limit(1);
    if (!post || post.deletedAt) return { ok: false, error: 'error_not_found' };

    // The new comment's path is its parent's path plus the parent — which is
    // why the path excludes self, and why no second UPDATE is needed after the
    // insert to fill in an id that didn't exist yet.
    let path: number[] = [];
    if (input.parentId) {
      const [parent] = await db
        .select({ id: comments.id, path: comments.path, postId: comments.postId })
        .from(comments)
        .where(eq(comments.id, input.parentId))
        .limit(1);
      if (!parent || parent.postId !== input.postId) {
        return { ok: false, error: 'error_not_found' };
      }
      path = [...(parent.path ?? []), parent.id];
      if (path.length >= MAX_COMMENT_DEPTH) return { ok: false, error: 'error_too_deep' };
    }

    const [comment] = await db
      .insert(comments)
      .values({ postId: input.postId, authorId: userId, parentId: input.parentId ?? null, path, body })
      .returning({ id: comments.id });

    const award = socialAward({
      kind: 'comment_created',
      basePoints: POINTS.commentCreated,
      earnedLast24h: actor.earnedLast24h,
      accountCreatedAt: actor.createdAt,
      currentKarma: actor.karma,
      now,
    });
    await runBatch([
      db
        .insert(karmaEvents)
        .values({ userId, commentId: comment.id, kind: award.kind, points: award.points }),
      db
        .update(users)
        .set({ karma: sql`${users.karma} + ${award.points}` })
        .where(eq(users.id, userId)),
    ]);

    revalidatePath('/[locale]/z/[slug]/post/[id]', 'page');
    return { ok: true, commentId: comment.id, pointsAwarded: award.points, note: award.note };
  } catch (error) {
    console.error('addComment failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}

/** value: 1, -1, or 0 to clear. Scores are maintained by database trigger. */
export async function voteOnPost(input: { postId: number; value: number }): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };

  const value = Math.sign(input.value);
  try {
    if (value === 0) {
      await db
        .delete(postVotes)
        .where(and(eq(postVotes.postId, input.postId), eq(postVotes.userId, userId)));
    } else {
      await db
        .insert(postVotes)
        .values({ postId: input.postId, userId, value })
        .onConflictDoUpdate({
          target: [postVotes.postId, postVotes.userId],
          set: { value },
        });
    }

    // Threshold awards, read after the trigger has applied the new score.
    const [post] = await db
      .select({ score: posts.score, authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .limit(1);
    if (post && post.authorId !== userId) {
      for (const award of POST_SCORE_AWARDS) {
        if (post.score >= award.atScore) {
          await payOnce(award.kind, { postId: input.postId }, post.authorId, award.points);
        }
      }
    }

    revalidatePath('/[locale]/z/[slug]', 'page');
    return { ok: true };
  } catch (error) {
    console.error('voteOnPost failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}

export async function voteOnComment(input: {
  commentId: number;
  value: number;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };

  const value = Math.sign(input.value);
  try {
    if (value === 0) {
      await db
        .delete(commentVotes)
        .where(and(eq(commentVotes.commentId, input.commentId), eq(commentVotes.userId, userId)));
    } else {
      await db
        .insert(commentVotes)
        .values({ commentId: input.commentId, userId, value })
        .onConflictDoUpdate({
          target: [commentVotes.commentId, commentVotes.userId],
          set: { value },
        });
    }

    const [comment] = await db
      .select({ score: comments.score, authorId: comments.authorId })
      .from(comments)
      .where(eq(comments.id, input.commentId))
      .limit(1);
    if (comment && comment.authorId !== userId) {
      for (const award of COMMENT_SCORE_AWARDS) {
        if (comment.score >= award.atScore) {
          await payOnce(award.kind, { commentId: input.commentId }, comment.authorId, award.points);
        }
      }
    }

    revalidatePath('/[locale]/z/[slug]/post/[id]', 'page');
    return { ok: true };
  } catch (error) {
    console.error('voteOnComment failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}

export async function toggleZoneMembership(input: { zoneId: number }): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };

  try {
    const [existing] = await db
      .select({ role: zoneMembers.role })
      .from(zoneMembers)
      .where(and(eq(zoneMembers.zoneId, input.zoneId), eq(zoneMembers.userId, userId)))
      .limit(1);

    if (existing) {
      await db
        .delete(zoneMembers)
        .where(and(eq(zoneMembers.zoneId, input.zoneId), eq(zoneMembers.userId, userId)));
    } else {
      await db.insert(zoneMembers).values({ zoneId: input.zoneId, userId, role: 'member' });
    }

    revalidatePath('/[locale]/z/[slug]', 'page');
    revalidatePath('/[locale]/(tabs)/community', 'page');
    return { ok: true };
  } catch (error) {
    console.error('toggleZoneMembership failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}

export async function reportContent(input: {
  postId?: number;
  commentId?: number;
  reason: string;
  note?: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };
  if (!input.postId && !input.commentId) return { ok: false, error: 'error_not_found' };

  try {
    await db.insert(postReports).values({
      postId: input.postId ?? null,
      commentId: input.commentId ?? null,
      reporterId: userId,
      reason: input.reason.trim().slice(0, 40) || 'other',
      note: input.note?.trim().slice(0, 400) || null,
    });
    return { ok: true };
  } catch (error) {
    console.error('reportContent failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}

/** Soft-remove a post. Author may always remove their own; mods may remove any. */
export async function removePost(input: { postId: number }): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };

  try {
    const [row] = await db
      .select({ authorId: posts.authorId, zoneId: posts.zoneId })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .limit(1);
    if (!row) return { ok: false, error: 'error_not_found' };

    let allowed = row.authorId === userId;
    if (!allowed) {
      const [me] = await db
        .select({ karma: users.karma })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const [membership] = await db
        .select({ role: zoneMembers.role })
        .from(zoneMembers)
        .where(and(eq(zoneMembers.zoneId, row.zoneId), eq(zoneMembers.userId, userId)))
        .limit(1);
      allowed = canModerateZone({
        karma: me?.karma ?? 0,
        isZoneMod: membership?.role === 'mod',
      });
    }
    if (!allowed) return { ok: false, error: 'error_not_moderator' };

    const statements: BatchItem[] = [
      db
        .update(posts)
        .set({ deletedAt: new Date(), removedBy: userId })
        .where(eq(posts.id, input.postId)),
      db
        .update(postReports)
        .set({ status: 'upheld', resolvedBy: userId, resolvedAt: new Date() })
        .where(and(eq(postReports.postId, input.postId), eq(postReports.status, 'open'))),
    ];
    await runBatch(statements);

    revalidatePath('/[locale]/z/[slug]', 'page');
    revalidatePath('/[locale]/(tabs)/community', 'page');
    return { ok: true };
  } catch (error) {
    console.error('removePost failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}

/** Most recent posts by one author — used by the profile page. */
export async function recentPostsByUser(userId: number, limit = 5) {
  return db
    .select({ id: posts.id, title: posts.title, score: posts.score, createdAt: posts.createdAt })
    .from(posts)
    .where(and(eq(posts.authorId, userId), sql`${posts.deletedAt} is null`))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}
