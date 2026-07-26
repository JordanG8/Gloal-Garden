import { cache } from 'react';
import { connection } from 'next/server';
import { db } from '@/db';
import { adoptions, observations, plants, species, users } from '@/db/schema';
import { and, count, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { computeStatus } from './plant-status';
import { rethrowIfPrerenderAbort } from './prerender';
import { activityWindowDays, isStewardActive, isUpForAdoption } from './karma';
import type { ObservationEntry, PlantSummary, StewardEntry } from './types';

const NEW_PLANT_WINDOW_DAYS = 14;

export interface GardenData {
  plants: PlantSummary[];
  dbReady: boolean;
}

type PlantRow = typeof plants.$inferSelect;
type SpeciesRow = typeof species.$inferSelect;

function toPlantSummary(
  plant: PlantRow,
  sp: SpeciesRow,
  plantedByName: string,
  stewardCount: number,
  photo?: { latestPhotoUrl: string | null; photoCount: number }
): PlantSummary {
  return {
    id: plant.id,
    name: plant.nickname || plant.customSpeciesName || sp.commonName,
    lat: plant.lat,
    lng: plant.lng,
    category: sp.category,
    speciesName: sp.commonName,
    speciesNameHe: sp.commonNameHe,
    emoji: sp.emoji,
    scientificName: sp.scientificName,
    customSpeciesName: plant.customSpeciesName,
    status: computeStatus(plant, sp),
    isNew:
      Date.now() - new Date(plant.plantedAt).getTime() <
      NEW_PLANT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    plantedAt: plant.plantedAt.toISOString(),
    lastWateredAt: plant.lastWateredAt?.toISOString() ?? null,
    plantedByName,
    founderId: plant.plantedBy,
    upForAdoption: isUpForAdoption(plant, sp),
    stewardCount,
    description: plant.description,
    accessNotes: plant.accessNotes,
    wateringFrequencyDays: sp.wateringFrequencyDays,
    daysToHarvest: sp.daysToHarvest,
    latestPhotoUrl: photo?.latestPhotoUrl ?? null,
    photoCount: photo?.photoCount ?? 0,
  };
}

/**
 * None of the reads below are cacheable (`cacheComponents` is on), so they must
 * never start during a prerender/prefetch pass: React aborts that render as soon
 * as it hits a request-time API, the in-flight query rejects with
 * HANGING_PROMISE_REJECTION, and the `catch` here would turn that into a
 * perfectly valid-looking *empty* garden — a map with no plant pins. Awaiting
 * `connection()` first keeps the query out of prerenders entirely, so the catch
 * only ever fires on a real database failure.
 */
export async function getGardenData(): Promise<GardenData> {
  await connection();
  try {
    const [plantRows, stewardCounts] = await Promise.all([
      db
        .select({
          plant: plants,
          species: species,
          plantedByName: users.displayName,
          latestPhotoUrl: sql<string | null>`(
            select o.photo_url from observations o
            where o.plant_id = ${plants.id} and o.photo_url is not null
            order by o.created_at desc, o.id desc limit 1
          )`,
          photoCount: sql<number>`(
            select count(*) from observations o
            where o.plant_id = ${plants.id} and o.photo_url is not null
          )::int`,
        })
        .from(plants)
        .innerJoin(species, eq(plants.speciesId, species.id))
        .innerJoin(users, eq(plants.plantedBy, users.id))
        .where(ne(plants.status, 'removed')),
      db
        .select({ plantId: adoptions.plantId, n: count() })
        .from(adoptions)
        .groupBy(adoptions.plantId),
    ]);

    const stewardCountByPlant = new Map(stewardCounts.map((row) => [row.plantId, Number(row.n)]));

    const mapped: PlantSummary[] = plantRows.map(
      ({ plant, species: sp, plantedByName, latestPhotoUrl, photoCount }) =>
        toPlantSummary(plant, sp, plantedByName, stewardCountByPlant.get(plant.id) ?? 0, {
          latestPhotoUrl,
          photoCount,
        })
    );

    return { plants: mapped, dbReady: true };
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load garden data (is POSTGRES_URL configured?):', error);
    return { plants: [], dbReady: false };
  }
}

/** Plant ids the viewer stewards — lets the map panel show Adopt vs. Stop stewarding. */
export async function getViewerAdoptedPlantIds(userId: number): Promise<number[]> {
  await connection();
  try {
    const rows = await db
      .select({ plantId: adoptions.plantId })
      .from(adoptions)
      .where(eq(adoptions.userId, userId));
    return rows.map((row) => row.plantId);
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load viewer adoptions:', error);
    return [];
  }
}

export interface PlantDetail {
  plant: PlantSummary;
  observations: ObservationEntry[];
  stewards: StewardEntry[];
  verified: boolean;
}

// cache() dedupes the per-request double call from generateMetadata + the page.
export const getPlantDetail = cache(async (id: number): Promise<PlantDetail | null> => {
  // Same reason as getGardenData: without this a prerendered pass can swallow
  // the aborted query and 404 a plant that exists.
  await connection();
  try {
    const [rows, logRows, stewardRows, verifiedRows] = await Promise.all([
      db
        .select({ plant: plants, species: species, plantedByName: users.displayName })
        .from(plants)
        .innerJoin(species, eq(plants.speciesId, species.id))
        .innerJoin(users, eq(plants.plantedBy, users.id))
        .where(eq(plants.id, id))
        .limit(1),
      db
        .select({
          id: observations.id,
          type: observations.type,
          caption: observations.caption,
          photoUrl: observations.photoUrl,
          harvestQuantity: observations.harvestQuantity,
          diseaseTag: observations.diseaseTag,
          createdAt: observations.createdAt,
          userName: users.displayName,
          userId: users.id,
          userAvatar: users.avatar,
          points: sql<number>`coalesce((
            select sum(k.points) from karma_events k
            where k.observation_id = ${observations.id}
          ), 0)::int`,
        })
        .from(observations)
        .innerJoin(users, eq(observations.userId, users.id))
        .where(eq(observations.plantId, id))
        .orderBy(desc(observations.createdAt), desc(observations.id))
        .limit(100),
      db
        .select({
          id: users.id,
          name: users.displayName,
          avatar: users.avatar,
          adoptedAt: adoptions.createdAt,
          lastActionAt: sql<string | null>`(
            select max(o.created_at) from observations o
            where o.user_id = ${adoptions.userId} and o.plant_id = ${adoptions.plantId}
          )`,
        })
        .from(adoptions)
        .innerJoin(users, eq(adoptions.userId, users.id))
        .where(eq(adoptions.plantId, id))
        .orderBy(adoptions.createdAt),
      db
        .select({ id: observations.id })
        .from(observations)
        .where(and(eq(observations.plantId, id), isNotNull(observations.photoUrl)))
        .limit(1),
    ]);

    const row = rows[0];
    if (!row) return null;

    const { plant, species: sp, plantedByName } = row;
    const windowDays = activityWindowDays(sp);

    const stewards: StewardEntry[] = stewardRows.map((steward) => ({
      id: steward.id,
      name: steward.name,
      avatar: steward.avatar,
      adoptedAt: steward.adoptedAt.toISOString(),
      active: isStewardActive({
        lastActionAt: steward.lastActionAt ? new Date(steward.lastActionAt) : null,
        adoptedAt: steward.adoptedAt,
        windowDays,
      }),
    }));

    const photoLogs = logRows.filter((log) => log.photoUrl);
    return {
      plant: toPlantSummary(plant, sp, plantedByName, stewards.length, {
        latestPhotoUrl: photoLogs[0]?.photoUrl ?? null,
        photoCount: photoLogs.length,
      }),
      observations: logRows.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
      stewards,
      verified: verifiedRows.length > 0,
    };
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load plant detail:', error);
    return null;
  }
});
