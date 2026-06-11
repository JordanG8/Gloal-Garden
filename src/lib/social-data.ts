import { cache } from 'react';
import { db } from '@/db';
import { adoptions, follows, observations, plants, species, users } from '@/db/schema';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { computeStatus } from './plant-status';
import type { FeedEntry, GardenerProfile, UserStats } from './types';

const DEFAULT_STATS: UserStats = { plantsAdded: 0, photosContributed: 0, careActions: 0, harvestsLogged: 0 };

const feedSelection = {
  id: observations.id,
  type: observations.type,
  caption: observations.caption,
  photoUrl: observations.photoUrl,
  harvestQuantity: observations.harvestQuantity,
  diseaseTag: observations.diseaseTag,
  createdAt: observations.createdAt,
  userName: users.displayName,
  userId: observations.userId,
  plantId: observations.plantId,
  plantName: plants.nickname,
  plantEmoji: species.emoji,
  plantSpecies: species.commonName,
};

function feedBase() {
  return db
    .select(feedSelection)
    .from(observations)
    .innerJoin(users, eq(observations.userId, users.id))
    .innerJoin(plants, eq(observations.plantId, plants.id))
    .innerJoin(species, eq(plants.speciesId, species.id));
}

function toFeedEntry(row: Omit<FeedEntry, 'createdAt'> & { createdAt: Date }): FeedEntry {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function getCommunityFeed(opts?: { followerId?: number; limit?: number }): Promise<FeedEntry[]> {
  try {
    let query;
    if (opts?.followerId) {
      query = feedBase()
        .innerJoin(follows, and(eq(follows.followingId, observations.userId), eq(follows.followerId, opts.followerId)));
    } else {
      query = feedBase();
    }
    const rows = await query.orderBy(desc(observations.createdAt)).limit(opts?.limit ?? 60);
    return rows.map(toFeedEntry);
  } catch (error) {
    console.error('Failed to load community feed:', error);
    return [];
  }
}

export const getGardenerProfile = cache(
  async (id: number, viewerId: number | null): Promise<GardenerProfile | null> => {
    try {
      const [userRows, followerCount, followingCount, plantRows, adoptedRows, activityRows, viewerFollow] =
        await Promise.all([
          db.select().from(users).where(eq(users.id, id)).limit(1),
          db.select({ count: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, id)),
          db.select({ count: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerId, id)),
          db
            .select({ plant: plants, species: species })
            .from(plants)
            .innerJoin(species, eq(plants.speciesId, species.id))
            .where(and(eq(plants.plantedBy, id), ne(plants.status, 'removed')))
            .orderBy(desc(plants.plantedAt)),
          db
            .select({ plant: plants, species: species })
            .from(adoptions)
            .innerJoin(plants, eq(adoptions.plantId, plants.id))
            .innerJoin(species, eq(plants.speciesId, species.id))
            .where(and(eq(adoptions.userId, id), ne(plants.status, 'removed'))),
          feedBase().where(eq(observations.userId, id)).orderBy(desc(observations.createdAt)).limit(20),
          viewerId
            ? db
                .select({ followerId: follows.followerId })
                .from(follows)
                .where(and(eq(follows.followerId, viewerId), eq(follows.followingId, id)))
                .limit(1)
            : Promise.resolve([]),
        ]);

      const user = userRows[0];
      if (!user) return null;

      const toPlantCard = ({ plant, species: sp }: { plant: typeof plants.$inferSelect; species: typeof species.$inferSelect }) => ({
        id: plant.id,
        name: plant.nickname || sp.commonName,
        emoji: sp.emoji,
        status: computeStatus(plant, sp),
      });

      return {
        id: user.id,
        displayName: user.displayName,
        bio: user.bio,
        location: user.location,
        avatar: user.avatar,
        joinedAt: user.createdAt.toISOString(),
        stats: { ...DEFAULT_STATS, ...(user.stats ?? {}) },
        badges: user.badges ?? [],
        followerCount: followerCount[0]?.count ?? 0,
        followingCount: followingCount[0]?.count ?? 0,
        isFollowing: viewerFollow.length > 0,
        plants: plantRows.map(toPlantCard),
        adoptedPlants: adoptedRows.map(toPlantCard),
        recentActivity: activityRows.map(toFeedEntry),
      };
    } catch (error) {
      console.error('Failed to load gardener profile:', error);
      return null;
    }
  }
);

/** Top gardeners for the community page sidebar, by total contributions. */
export async function getTopGardeners(limit = 8) {
  try {
    const rows = await db.select().from(users).limit(50);
    return rows
      .map((u) => {
        const stats = { ...DEFAULT_STATS, ...(u.stats ?? {}) };
        return {
          id: u.id,
          displayName: u.displayName,
          avatar: u.avatar,
          bio: u.bio,
          total: stats.plantsAdded + stats.photosContributed + stats.careActions + stats.harvestsLogged,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  } catch (error) {
    console.error('Failed to load top gardeners:', error);
    return [];
  }
}

export async function getGardenerIds(): Promise<number[]> {
  try {
    const rows = await db.select({ id: users.id }).from(users);
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}
