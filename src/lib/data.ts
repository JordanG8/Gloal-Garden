import { cache } from 'react';
import { connection } from 'next/server';
import { db } from '@/db';
import { adoptions, observations, plants, species, users, zones } from '@/db/schema';
import { and, count, desc, eq, inArray, isNotNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { computeStatus } from './plant-status';
import { rethrowIfPrerenderAbort } from './prerender';
import { activityWindowDays, isStewardActive, isUpForAdoption } from './karma';
import {
  CLUSTER_LIMIT,
  DISTRICT_REACH_M,
  districtBounds,
  districtTouches,
  expandBounds,
  innermostDistricts,
  normalizeBounds,
  PIN_LIMIT,
  splitAntimeridian,
  statusToCode,
  type District,
  type MapBounds,
  type MapFilter,
  type MapPoint,
} from './map-bounds';
import type { ObservationEntry, PlantSummary, StewardEntry } from './types';

const NEW_PLANT_WINDOW_DAYS = 14;

/**
 * `geo` is a generated `point(lng, lat)` column with a GiST index, so a
 * viewport read is a bitmap index scan instead of a full-table scan. A
 * viewport straddling the antimeridian becomes two boxes OR'd together.
 */
function withinBounds(rawBounds: MapBounds): SQL {
  const boxes = splitAntimeridian(normalizeBounds(rawBounds)).map(
    (b) =>
      sql`${plants.geo} <@ box(point(${b.minLng}, ${b.minLat}), point(${b.maxLng}, ${b.maxLat}))`
  );
  return boxes.length === 1 ? boxes[0] : or(...boxes)!;
}

// Lives in map-bounds.ts, which the client can import at runtime; re-exported
// here so the existing `from '@/lib/data'` call sites keep working.
export type { MapFilter };

export interface GardenData {
  plants: PlantSummary[];
  dbReady: boolean;
  /** The viewport held more plants than the pin cap; the map says "zoom in". */
  truncated: boolean;
}

function matchesFilter(plant: PlantSummary, filter: MapFilter): boolean {
  switch (filter) {
    case 'water':
      return plant.status === 'needs_water';
    case 'harvest':
      return plant.status === 'ready_to_harvest';
    case 'steward':
      return plant.upForAdoption;
    case 'trouble':
      return plant.status === 'needs_attention' || plant.status === 'diseased';
    default:
      return true;
  }
}

type PlantRow = typeof plants.$inferSelect;
type SpeciesRow = typeof species.$inferSelect;

function toPlantSummary(
  plant: PlantRow,
  sp: SpeciesRow,
  plantedByName: string,
  stewardCount: number,
  // Only getPlantDetail passes this — it has already loaded the real
  // observation list, so it can be exact rather than trusting the counters.
  photo?: { latestPhotoUrl: string | null; photoCount: number }
): PlantSummary {
  return {
    id: plant.id,
    name: plant.nickname || plant.customSpeciesName || sp.commonName,
    quantity: plant.quantity,
    gardenId: plant.gardenId,
    bedLabel: plant.bedLabel,
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
    latestPhotoUrl: photo?.latestPhotoUrl ?? plant.latestPhotoUrl,
    photoCount: photo?.photoCount ?? plant.photoCount,
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
export async function getGardenData(
  bounds: MapBounds,
  filter: MapFilter = 'all'
): Promise<GardenData> {
  await connection();
  try {
    // `needs_water` / `ready_to_harvest` / `upForAdoption` are derived from
    // species cadence at read time, so they can't be a WHERE clause without
    // duplicating karma.ts and plant-status.ts in SQL. Instead read the whole
    // viewport (already bounded by the GiST index and hard-capped), then filter
    // and tally in one pass. Exact for any viewport under CLUSTER_LIMIT plants.
    const plantRows = await db
      .select({ plant: plants, species: species, plantedByName: users.displayName })
      .from(plants)
      .innerJoin(species, eq(plants.speciesId, species.id))
      .innerJoin(users, eq(plants.plantedBy, users.id))
      .where(and(ne(plants.status, 'removed'), withinBounds(bounds)))
      // Newest first, so a viewport denser than the cap shows recent activity
      // rather than an arbitrary slice.
      .orderBy(desc(plants.plantedAt))
      .limit(CLUSTER_LIMIT);

    const stewardCountByPlant = await stewardCountsFor(plantRows.map((row) => row.plant.id));
    const all: PlantSummary[] = plantRows.map(({ plant, species: sp, plantedByName }) =>
      toPlantSummary(plant, sp, plantedByName, stewardCountByPlant.get(plant.id) ?? 0)
    );

    const matching = filter === 'all' ? all : all.filter((p) => matchesFilter(p, filter));
    return {
      plants: matching.slice(0, PIN_LIMIT),
      dbReady: true,
      truncated: matching.length > PIN_LIMIT,
    };
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load garden data (is POSTGRES_URL configured?):', error);
    return { plants: [], dbReady: false, truncated: false };
  }
}

/** Candidates to read before the exact circle test; the box test is indexed. */
const DISTRICT_CANDIDATES = 64;
/** How many districts one count query may name, so the SQL stays a sane size. */
const DISTRICT_LIMIT = 24;

/**
 * The districts this viewport is in range of.
 *
 * The box pre-filter is what keeps this off a sequential scan as grid cells
 * accumulate — `zones.geo` is GiST-indexed, and a circle's reach isn't
 * expressible as one. Zones wider than DISTRICT_REACH_M are therefore only
 * found once the viewport is wide enough to hold their centre, which is exactly
 * when they stop being too coarse to count against.
 */
async function districtsInRange(bounds: MapBounds): Promise<District[]> {
  const reach = expandBounds(bounds, DISTRICT_REACH_M);
  const boxes = splitAntimeridian(reach).map(
    (b) => sql`${zones.geo} <@ box(point(${b.minLng}, ${b.minLat}), point(${b.maxLng}, ${b.maxLat}))`
  );
  const rows = await db
    .select({ id: zones.id, lat: zones.lat, lng: zones.lng, radiusM: zones.radiusM })
    .from(zones)
    .where(boxes.length === 1 ? boxes[0] : or(...boxes)!)
    // Widest first: if a dense patch of grid cells overruns the cap, keep the
    // districts that account for the most ground.
    .orderBy(desc(zones.radiusM))
    .limit(DISTRICT_CANDIDATES);

  const touching = rows.filter((district) => districtTouches(bounds, district));
  return innermostDistricts(touching).slice(0, DISTRICT_LIMIT);
}

/** Plants inside one district: indexed box first, then the exact circle. */
function withinDistrict(district: District): SQL {
  return and(
    withinBounds(districtBounds(district)),
    sql`(6371000 * acos(least(1, greatest(-1,
      cos(radians(${plants.lat})) * cos(radians(${district.lat}))
        * cos(radians(${district.lng}) - radians(${plants.lng}))
      + sin(radians(${plants.lat})) * sin(radians(${district.lat}))
    )))) <= ${district.radiusM}`
  )!;
}

/**
 * How many plants the map's chip claims — everything in the viewport *plus*
 * everything in the districts the viewport is in range of.
 *
 * A pure viewport count shrank every time you zoomed in, which reads as plants
 * disappearing rather than as the camera narrowing. Anchoring it to the
 * districts on screen means the number holds still while you move around inside
 * a neighbourhood, and only changes when the neighbourhoods do.
 *
 * The viewport itself stays in the union for the cases districts can't cover:
 * open country between towns, a zoom level wider than any district in range,
 * and a database whose zones were never seeded — where this degrades to exactly
 * the old per-viewport count.
 *
 * One `count(*)`, so overlapping districts can't count a plant twice.
 */
export async function getRegionCount(bounds: MapBounds): Promise<number> {
  await connection();
  try {
    const districts = await districtsInRange(bounds);
    const [row] = await db
      .select({ n: count() })
      .from(plants)
      .where(
        and(
          ne(plants.status, 'removed'),
          or(withinBounds(bounds), ...districts.map(withinDistrict))
        )
      );
    return Number(row?.n ?? 0);
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to count the region:', error);
    return 0;
  }
}

/** Steward counts for a known set of plants — never a full-table group-by. */
async function stewardCountsFor(plantIds: number[]): Promise<Map<number, number>> {
  if (plantIds.length === 0) return new Map();
  const rows = await db
    .select({ plantId: adoptions.plantId, n: count() })
    .from(adoptions)
    .where(inArray(adoptions.plantId, plantIds))
    .groupBy(adoptions.plantId);
  return new Map(rows.map((row) => [row.plantId, Number(row.n)]));
}

/**
 * The cluster tier (zoom 12–15.5). Returns the slim `MapPoint` wire format —
 * a full PlantSummary is ~400 bytes, so 3000 of them is over a megabyte for
 * data the map only uses to place a coloured dot.
 */
export async function getMapPoints(bounds: MapBounds): Promise<MapPoint[]> {
  await connection();
  try {
    const rows = await db
      .select({
        id: plants.id,
        lat: plants.lat,
        lng: plants.lng,
        status: plants.status,
        plantedAt: plants.plantedAt,
        lastWateredAt: plants.lastWateredAt,
        lastCheckedAt: plants.lastCheckedAt,
        daysToHarvest: species.daysToHarvest,
        wateringFrequencyDays: species.wateringFrequencyDays,
      })
      .from(plants)
      .innerJoin(species, eq(plants.speciesId, species.id))
      .where(and(ne(plants.status, 'removed'), withinBounds(bounds)))
      .limit(CLUSTER_LIMIT);

    return rows.map((row) => ({
      i: row.id,
      x: row.lng,
      y: row.lat,
      s: statusToCode(computeStatus(row, row)),
      a: isUpForAdoption(row, row) ? 1 : 0,
    }));
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load map points:', error);
    return [];
  }
}

export interface MyGarden {
  founded: PlantSummary[];
  stewarding: PlantSummary[];
}

/**
 * The Garden tab used to load every plant in the world and filter in JS.
 * This asks the database the question the page actually has.
 */
export async function getMyGarden(userId: number): Promise<MyGarden> {
  await connection();
  try {
    const rows = await db
      .select({ plant: plants, species: species, plantedByName: users.displayName })
      .from(plants)
      .innerJoin(species, eq(plants.speciesId, species.id))
      .innerJoin(users, eq(plants.plantedBy, users.id))
      .where(
        and(
          ne(plants.status, 'removed'),
          or(
            eq(plants.plantedBy, userId),
            sql`exists (
              select 1 from adoptions a
              where a.plant_id = ${plants.id} and a.user_id = ${userId}
            )`
          )
        )
      )
      .orderBy(desc(plants.plantedAt));

    const stewardCountByPlant = await stewardCountsFor(rows.map((row) => row.plant.id));
    const mapped = rows.map(({ plant, species: sp, plantedByName }) =>
      toPlantSummary(plant, sp, plantedByName, stewardCountByPlant.get(plant.id) ?? 0)
    );

    return {
      founded: mapped.filter((p) => p.founderId === userId),
      stewarding: mapped.filter((p) => p.founderId !== userId),
    };
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load my garden:', error);
    return { founded: [], stewarding: [] };
  }
}

/**
 * Plants near a point that have lost their steward. Ordered by real distance
 * via the GiST KNN operator, so "nearby" means nearby rather than "first four
 * rows in the table".
 */
export async function getAdoptablesNear(
  center: { lat: number; lng: number },
  userId: number,
  limit = 4
): Promise<PlantSummary[]> {
  await connection();
  try {
    const rows = await db
      .select({ plant: plants, species: species, plantedByName: users.displayName })
      .from(plants)
      .innerJoin(species, eq(plants.speciesId, species.id))
      .innerJoin(users, eq(plants.plantedBy, users.id))
      .where(
        and(
          ne(plants.status, 'removed'),
          ne(plants.plantedBy, userId),
          sql`not exists (
            select 1 from adoptions a
            where a.plant_id = ${plants.id} and a.user_id = ${userId}
          )`
        )
      )
      .orderBy(sql`${plants.geo} <-> point(${center.lng}, ${center.lat})`)
      // Over-fetch: "needs a steward" is derived in JS from watering cadence,
      // so it can't be a WHERE clause without duplicating karma.ts in SQL.
      .limit(limit * 20);

    const candidates = rows.filter(({ plant, species: sp }) => isUpForAdoption(plant, sp));
    const stewardCountByPlant = await stewardCountsFor(candidates.map((r) => r.plant.id));

    return candidates
      .slice(0, limit)
      .map(({ plant, species: sp, plantedByName }) =>
        toPlantSummary(plant, sp, plantedByName, stewardCountByPlant.get(plant.id) ?? 0)
      );
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load nearby adoptables:', error);
    return [];
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
