import { db } from '@/db';
import { adoptions, karmaEvents, observations, plants, species, users } from '@/db/schema';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { activityWindowDays, isStewardActive } from './karma';
import type { LeaderboardRow, UserProfile } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getUserProfile(id: number): Promise<UserProfile | null> {
  try {
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);
    const [userRows, statRows, rescueRows, stewardshipRows, eventRows, weekRows] = await Promise.all([
      db
        .select({
          id: users.id,
          displayName: users.displayName,
          avatar: users.avatar,
          bio: users.bio,
          location: users.location,
          createdAt: users.createdAt,
          karma: users.karma,
          badges: users.badges,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1),
      // Contribution stats computed from real history, not the legacy
      // users.stats counters.
      db
        .select({
          plantsFounded: sql<number>`(select count(*) from plants p where p.planted_by = ${id})::int`,
          harvests: sql<number>`count(*) filter (where ${observations.type} = 'harvest')::int`,
          verifiedHarvests: sql<number>`count(*) filter (where ${observations.type} = 'harvest' and ${observations.photoUrl} is not null)::int`,
          waterings: sql<number>`count(*) filter (where ${observations.type} = 'water')::int`,
          photos: sql<number>`count(*) filter (where ${observations.type} = 'photo')::int`,
        })
        .from(observations)
        .where(eq(observations.userId, id)),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(karmaEvents)
        .where(and(eq(karmaEvents.userId, id), eq(karmaEvents.kind, 'rescue_bonus'))),
      db
        .select({
          plantId: adoptions.plantId,
          adoptedAt: adoptions.createdAt,
          nickname: plants.nickname,
          commonName: species.commonName,
          category: species.category,
          wateringFrequencyDays: species.wateringFrequencyDays,
          lastActionAt: sql<string | null>`(
            select max(o.created_at) from observations o
            where o.user_id = ${id} and o.plant_id = ${adoptions.plantId}
          )`,
        })
        .from(adoptions)
        .innerJoin(plants, eq(adoptions.plantId, plants.id))
        .innerJoin(species, eq(plants.speciesId, species.id))
        .where(eq(adoptions.userId, id))
        .orderBy(desc(adoptions.createdAt)),
      db
        .select({
          id: karmaEvents.id,
          kind: karmaEvents.kind,
          points: karmaEvents.points,
          plantId: karmaEvents.plantId,
          createdAt: karmaEvents.createdAt,
          nickname: plants.nickname,
          commonName: species.commonName,
        })
        .from(karmaEvents)
        .leftJoin(plants, eq(karmaEvents.plantId, plants.id))
        .leftJoin(species, eq(plants.speciesId, species.id))
        .where(eq(karmaEvents.userId, id))
        .orderBy(desc(karmaEvents.createdAt))
        .limit(20),
      db
        .select({ total: sql<number>`coalesce(sum(${karmaEvents.points}), 0)::int` })
        .from(karmaEvents)
        .where(and(eq(karmaEvents.userId, id), gt(karmaEvents.createdAt, weekAgo))),
    ]);

    const user = userRows[0];
    if (!user) return null;
    const stats = statRows[0];

    return {
      id: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      createdAt: user.createdAt.toISOString(),
      karma: user.karma,
      karma7d: weekRows[0]?.total ?? 0,
      badges: user.badges ?? [],
      stats: {
        plantsFounded: stats?.plantsFounded ?? 0,
        harvests: stats?.harvests ?? 0,
        verifiedHarvests: stats?.verifiedHarvests ?? 0,
        waterings: stats?.waterings ?? 0,
        photos: stats?.photos ?? 0,
        rescues: rescueRows[0]?.n ?? 0,
      },
      stewardships: stewardshipRows.map((row) => ({
        plantId: row.plantId,
        plantName: row.nickname || row.commonName,
        category: row.category,
        adoptedAt: row.adoptedAt.toISOString(),
        active: isStewardActive({
          lastActionAt: row.lastActionAt ? new Date(row.lastActionAt) : null,
          adoptedAt: row.adoptedAt,
          windowDays: activityWindowDays({ wateringFrequencyDays: row.wateringFrequencyDays }),
        }),
      })),
      recentEvents: eventRows.map((event) => ({
        id: event.id,
        kind: event.kind,
        points: event.points,
        plantId: event.plantId,
        plantName: event.plantId ? event.nickname || event.commonName : null,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('Failed to load user profile:', error);
    return null;
  }
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  try {
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);
    const [rows, weekRows] = await Promise.all([
      db
        .select({
          id: users.id,
          displayName: users.displayName,
          avatar: users.avatar,
          karma: users.karma,
          badges: users.badges,
        })
        .from(users)
        .orderBy(desc(users.karma), users.id)
        .limit(20),
      db
        .select({
          userId: karmaEvents.userId,
          total: sql<number>`coalesce(sum(${karmaEvents.points}), 0)::int`,
        })
        .from(karmaEvents)
        .where(gt(karmaEvents.createdAt, weekAgo))
        .groupBy(karmaEvents.userId),
    ]);

    const weekByUser = new Map(weekRows.map((row) => [row.userId, row.total]));
    return rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      avatar: row.avatar,
      karma: row.karma,
      karma7d: weekByUser.get(row.id) ?? 0,
      badges: row.badges ?? [],
    }));
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
    return [];
  }
}

/**
 * Current value of every badge metric for a user — powers the locked-badge
 * progress numbers (e.g. "23/50") on the profile.
 */
export async function getBadgeProgress(
  id: number
): Promise<Partial<Record<import('./karma').BadgeMetric, number>>> {
  try {
    const [kindRows, extraRows] = await Promise.all([
      db
        .select({
          kind: karmaEvents.kind,
          earning: sql<number>`count(*) filter (where ${karmaEvents.points} > 0)::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(karmaEvents)
        .where(eq(karmaEvents.userId, id))
        .groupBy(karmaEvents.kind),
      db
        .select({
          plantsFounded: sql<number>`(select count(*) from plants p where p.planted_by = ${id})::int`,
          verifiedHarvests: sql<number>`(
            select count(*) from observations o
            where o.user_id = ${id} and o.type = 'harvest' and o.photo_url is not null
          )::int`,
          goodNeighbor: sql<number>`(
            select count(*) from karma_events k
            join plants p on p.id = k.plant_id
            where k.user_id = ${id} and k.points > 0
              and k.kind in ('water_due', 'photo', 'harvest', 'resolve')
              and p.planted_by <> ${id}
          )::int`,
          karma: sql<number>`(select karma from users u where u.id = ${id})::int`,
        })
        .from(sql`(select 1) as one`),
    ]);

    const byKind = new Map(kindRows.map((row) => [row.kind, row]));
    const earning = (kind: string) => byKind.get(kind)?.earning ?? 0;
    const total = (kind: string) => byKind.get(kind)?.total ?? 0;
    const extra = extraRows[0];

    return {
      plantsFounded: extra?.plantsFounded ?? 0,
      earningHarvests: earning('harvest'),
      verifiedHarvests: extra?.verifiedHarvests ?? 0,
      earningWaterDue: earning('water_due'),
      rescueBonuses: total('rescue_bonus'),
      goodNeighborEvents: extra?.goodNeighbor ?? 0,
      adopts: total('adopt'),
      reportsConfirmed: total('report_confirmed'),
      earningPhotos: earning('photo'),
      firstHarvestBonuses: total('plant_first_harvest'),
      karma: extra?.karma ?? 0,
    };
  } catch (error) {
    console.error('getBadgeProgress failed:', error);
    return {};
  }
}
