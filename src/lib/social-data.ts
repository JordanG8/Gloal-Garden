import 'server-only';
import { connection } from 'next/server';
import { db } from '@/db';
import {
  commentVotes,
  comments,
  postVotes,
  posts,
  users,
  zoneMembers,
  zones,
} from '@/db/schema';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { rethrowIfPrerenderAbort } from './prerender';
import { FEED_PAGE_SIZE, type FeedSort, type PostKind } from './social-kinds';

/**
 * Feed reads.
 *
 * Every query that wants the ranking index must repeat `deleted_at is null`
 * verbatim — a partial index is only used when the predicate matches. That's
 * why the condition lives in one shared constant here rather than being typed
 * out at each call site.
 */

const LIVE = sql`${posts.deletedAt} is null`;

export interface ZoneSummary {
  id: number;
  slug: string;
  name: string;
  nameHe: string | null;
  description: string | null;
  kind: string;
  lat: number;
  lng: number;
  plantCount: number;
  postCount: number;
  memberCount: number;
  isOfficial: boolean;
}

export interface PostSummary {
  id: number;
  kind: PostKind;
  title: string;
  body: string | null;
  photoUrl: string | null;
  score: number;
  commentCount: number;
  createdAt: string;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  zoneSlug: string;
  zoneName: string;
  plantId: number | null;
  /** The viewer's own vote: 1, -1 or 0. Never cached — it's per-viewer. */
  myVote: number;
}

export interface CommentNode {
  id: number;
  body: string;
  score: number;
  createdAt: string;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  depth: number;
  deleted: boolean;
  myVote: number;
}

function toZone(row: typeof zones.$inferSelect): ZoneSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameHe: row.nameHe,
    description: row.description,
    kind: row.kind,
    lat: row.lat,
    lng: row.lng,
    plantCount: row.plantCount,
    postCount: row.postCount,
    memberCount: row.memberCount,
    isOfficial: row.isOfficial === 1,
  };
}

export async function getZoneBySlug(slug: string): Promise<ZoneSummary | null> {
  await connection();
  try {
    const [row] = await db.select().from(zones).where(eq(zones.slug, slug)).limit(1);
    return row ? toZone(row) : null;
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    return null;
  }
}

function orderFor(sort: FeedSort): SQL {
  if (sort === 'new') return sql`${posts.createdAt} desc`;
  if (sort === 'top') return sql`${posts.score} desc, ${posts.createdAt} desc`;
  // Referenced as raw SQL rather than through the schema: `hot_rank` is a
  // STORED generated column created in migration 0011, and declaring it in
  // schema.ts would make drizzle-kit try to add it again. It's never selected,
  // only ordered by, so the raw reference costs nothing.
  return sql`posts.hot_rank desc nulls last`;
}

async function decoratePosts(
  rows: {
    post: typeof posts.$inferSelect;
    authorName: string;
    authorAvatar: string | null;
    zoneSlug: string;
    zoneName: string;
  }[],
  viewerId: number | null
): Promise<PostSummary[]> {
  // The viewer's votes are fetched separately rather than joined, so the feed
  // query itself stays viewer-agnostic (and therefore cacheable later).
  let myVotes = new Map<number, number>();
  if (viewerId !== null && rows.length > 0) {
    const voteRows = await db
      .select({ postId: postVotes.postId, value: postVotes.value })
      .from(postVotes)
      .where(
        and(
          eq(postVotes.userId, viewerId),
          inArray(
            postVotes.postId,
            rows.map((r) => r.post.id)
          )
        )
      );
    myVotes = new Map(voteRows.map((v) => [v.postId, v.value]));
  }

  return rows.map(({ post, authorName, authorAvatar, zoneSlug, zoneName }) => ({
    id: post.id,
    kind: post.kind as PostKind,
    title: post.title,
    body: post.body,
    photoUrl: post.photoUrl,
    score: post.score,
    commentCount: post.commentCount,
    createdAt: post.createdAt.toISOString(),
    authorId: post.authorId,
    authorName,
    authorAvatar,
    zoneSlug,
    zoneName,
    plantId: post.plantId,
    myVote: myVotes.get(post.id) ?? 0,
  }));
}

const POST_SELECT = {
  post: posts,
  authorName: users.displayName,
  authorAvatar: users.avatar,
  zoneSlug: zones.slug,
  zoneName: zones.name,
};

/**
 * One zone's posts. Includes descendants, so a city feed carries its
 * neighbourhoods — `ancestor_ids` is materialized precisely so this doesn't
 * need a recursive CTE per read.
 */
export async function listZonePosts(
  zoneId: number,
  sort: FeedSort,
  viewerId: number | null,
  limit = FEED_PAGE_SIZE
): Promise<PostSummary[]> {
  await connection();
  try {
    const rows = await db
      .select(POST_SELECT)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .innerJoin(zones, eq(posts.zoneId, zones.id))
      // Array containment on integer[], backed by the GIN index on
      // zones.ancestor_ids — so a city feed picks up its neighbourhoods
      // without a recursive CTE.
      .where(and(LIVE, sql`${zones.ancestorIds} @> ARRAY[${zoneId}]::integer[]`))
      .orderBy(orderFor(sort))
      .limit(limit);
    return decoratePosts(rows, viewerId);
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to list zone posts:', error);
    return [];
  }
}

/**
 * The home feed: zones you've joined, plus the ones nearest you.
 *
 * "Geographically relevant" is the whole point of the feature, so an empty
 * membership list still produces a useful feed rather than a blank page.
 */
export async function getHomeFeed(
  viewerId: number | null,
  near: { lat: number; lng: number },
  sort: FeedSort,
  limit = FEED_PAGE_SIZE
): Promise<PostSummary[]> {
  await connection();
  try {
    const nearby = await db
      .select({ id: zones.id })
      .from(zones)
      .orderBy(sql`${zones.geo} <-> point(${near.lng}, ${near.lat})`)
      .limit(8);

    const joined =
      viewerId === null
        ? []
        : await db
            .select({ id: zoneMembers.zoneId })
            .from(zoneMembers)
            .where(eq(zoneMembers.userId, viewerId));

    const zoneIds = [...new Set([...nearby.map((z) => z.id), ...joined.map((z) => z.id)])];
    if (zoneIds.length === 0) return [];

    const rows = await db
      .select(POST_SELECT)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .innerJoin(zones, eq(posts.zoneId, zones.id))
      .where(and(LIVE, inArray(posts.zoneId, zoneIds)))
      .orderBy(orderFor(sort))
      .limit(limit);
    return decoratePosts(rows, viewerId);
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load home feed:', error);
    return [];
  }
}

export interface PostDetail {
  post: PostSummary;
  comments: CommentNode[];
  viewerIsMember: boolean;
}

export async function getPostDetail(
  postId: number,
  viewerId: number | null
): Promise<PostDetail | null> {
  await connection();
  try {
    const [row] = await db
      .select(POST_SELECT)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .innerJoin(zones, eq(posts.zoneId, zones.id))
      .where(and(eq(posts.id, postId), LIVE))
      .limit(1);
    if (!row) return null;

    const [decorated] = await decoratePosts([row], viewerId);

    // Ordering by (path, created_at, id) is correct tree order with siblings
    // in chronological order, out of a single index scan. Soft-deleted rows
    // stay in the tree so their replies keep a parent — they render as
    // "[removed]" rather than orphaning a thread.
    const commentRows = await db
      .select({
        id: comments.id,
        body: comments.body,
        score: comments.score,
        createdAt: comments.createdAt,
        path: comments.path,
        deletedAt: comments.deletedAt,
        authorId: users.id,
        authorName: users.displayName,
        authorAvatar: users.avatar,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.postId, postId))
      // integer[] compares element-wise and numerically, which is exactly tree
      // order. Ordering the old json column meant casting to text, where [10]
      // sorts before [9] and threads come out scrambled.
      .orderBy(asc(comments.path), asc(comments.createdAt), asc(comments.id))
      .limit(500);

    let myCommentVotes = new Map<number, number>();
    if (viewerId !== null && commentRows.length > 0) {
      const voteRows = await db
        .select({ commentId: commentVotes.commentId, value: commentVotes.value })
        .from(commentVotes)
        .where(
          and(
            eq(commentVotes.userId, viewerId),
            inArray(
              commentVotes.commentId,
              commentRows.map((c) => c.id)
            )
          )
        );
      myCommentVotes = new Map(voteRows.map((v) => [v.commentId, v.value]));
    }

    const tree: CommentNode[] = commentRows.map((c) => ({
      id: c.id,
      body: c.deletedAt ? '' : c.body,
      score: c.score,
      createdAt: c.createdAt.toISOString(),
      authorId: c.authorId,
      authorName: c.authorName,
      authorAvatar: c.authorAvatar,
      // Depth is derived from the path — storing it too would be a third thing
      // to keep in sync. Capped for display: past three levels the 520px
      // column has no room left, so deeper replies render flat.
      depth: Math.min((c.path ?? []).length, 3),
      deleted: c.deletedAt !== null,
      myVote: myCommentVotes.get(c.id) ?? 0,
    }));

    let viewerIsMember = false;
    if (viewerId !== null) {
      const [membership] = await db
        .select({ userId: zoneMembers.userId })
        .from(zoneMembers)
        .where(
          and(eq(zoneMembers.zoneId, row.post.zoneId), eq(zoneMembers.userId, viewerId))
        )
        .limit(1);
      viewerIsMember = !!membership;
    }

    return { post: decorated, comments: tree, viewerIsMember };
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load post detail:', error);
    return null;
  }
}

/** Zones near a point, for the community page's "communities around you". */
export async function listZonesNear(
  near: { lat: number; lng: number },
  limit = 6
): Promise<ZoneSummary[]> {
  await connection();
  try {
    const rows = await db
      .select()
      .from(zones)
      // Auto-created cells stay out of the directory until they have something
      // in them, so an empty grid square never advertises itself.
      .where(sql`${zones.isOfficial} = 1 or ${zones.postCount} > 0 or ${zones.plantCount} >= 3`)
      .orderBy(sql`${zones.geo} <-> point(${near.lng}, ${near.lat})`)
      .limit(limit);
    return rows.map(toZone);
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to list nearby zones:', error);
    return [];
  }
}

/** Top gardeners in one zone — the leaderboard, made local. */
export async function getZoneLeaderboard(zoneId: number, limit = 10) {
  await connection();
  try {
    return await db
      .select({
        id: users.id,
        displayName: users.displayName,
        avatar: users.avatar,
        karma: users.karma,
      })
      .from(users)
      .innerJoin(zoneMembers, eq(zoneMembers.userId, users.id))
      .where(eq(zoneMembers.zoneId, zoneId))
      .orderBy(desc(users.karma))
      .limit(limit);
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    return [];
  }
}
