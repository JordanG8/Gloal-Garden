import { cache } from 'react';
import { connection } from 'next/server';
import { db } from '@/db';
import { adoptions, observations, plants, species, users, zones } from '@/db/schema';
import { and, count, desc, eq, inArray, isNotNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { computeStatus } from './plant-status';
import { rethrowIfPrerenderAbort } from './prerender';
import { activityWindowDays, isStewardActive, isUpForAdoption } from './karma';
import {
  boundsCenter,
  CLUSTER_LIMIT,
  DISTRICT_REACH_M,
  expandBounds,
  normalizeBounds,
  PIN_LIMIT,
  PIN_PRECISION,
  POINT_PRECISION,
  roundCoord,
  splitAntimeridian,
  statusToCode,
  type MapBounds,
  type MapFilter,
  type MapPoint,
} from './map-bounds';
import type { MapPlant, ObservationEntry, PlantSummary, StewardEntry } from './types';

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
  plants: MapPlant[];
  dbReady: boolean;
  /** The viewport held more plants than the pin cap; the map says "zoom in". */
  truncated: boolean;
}

function matchesFilter(plant: MapPlant, filter: MapFilter): boolean {
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

/** The narrow row `getGardenData` selects, folded into the map's wire format. */
function toMapPlant({
  plant,
  species: sp,
  plantedByName,
}: {
  plant: {
    id: number;
    lat: number;
    lng: number;
    nickname: string | null;
    customSpeciesName: string | null;
    latestPhotoUrl: string | null;
    status: string;
    plantedAt: Date;
    lastWateredAt: Date | null;
    lastCheckedAt: Date | null;
    careMode: string | null;
    waterIntervalSummerDays: number | null;
    waterIntervalWinterDays: number | null;
  };
  species: {
    commonName: string;
    commonNameHe: string | null;
    scientificName: string;
    category: string;
    emoji: string;
    daysToHarvest: number | null;
    wateringFrequencyDays: number;
    isPerennial: number;
    harvestMonthStart: number | null;
    harvestMonthEnd: number | null;
    yearsToFirstHarvest: number | null;
    waterIntervalSummerDays: number | null;
    waterIntervalWinterDays: number | null;
  };
  plantedByName: string;
}): MapPlant {
  return {
    id: plant.id,
    name: plant.nickname || plant.customSpeciesName || sp.commonName,
    lat: roundCoord(plant.lat, PIN_PRECISION),
    lng: roundCoord(plant.lng, PIN_PRECISION),
    category: sp.category,
    emoji: sp.emoji,
    speciesName: sp.commonName,
    speciesNameHe: sp.commonNameHe,
    scientificName: sp.scientificName,
    customSpeciesName: plant.customSpeciesName,
    plantedByName,
    status: computeStatus(plant, sp),
    upForAdoption: isUpForAdoption(plant, sp),
    latestPhotoUrl: plant.latestPhotoUrl,
  };
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
    // duplicating karma.ts and plant-status.ts in SQL — a filtered read still
    // has to over-fetch and sort it out here.
    //
    // The unfiltered read does not: every row it takes is a row it keeps, so it
    // stops at the pin cap (plus one, to know whether to say "zoom in"). That is
    // the case the map spends nearly all its time in, and it used to pull
    // CLUSTER_LIMIT fully-joined rows — 3000 — to render 200 of them.
    const overFetch = filter === 'all' ? PIN_LIMIT + 1 : CLUSTER_LIMIT;
    const center = boundsCenter(bounds);
    const plantRows = await db
      // Only the columns a pin draws with, plus the ones `computeStatus` and
      // `isUpForAdoption` read to derive its badge. Selecting the whole `plants`
      // and `species` rows dragged along care guides and soil notes for every
      // pin on screen.
      .select({
        plant: {
          id: plants.id,
          lat: plants.lat,
          lng: plants.lng,
          nickname: plants.nickname,
          customSpeciesName: plants.customSpeciesName,
          latestPhotoUrl: plants.latestPhotoUrl,
          status: plants.status,
          plantedAt: plants.plantedAt,
          lastWateredAt: plants.lastWateredAt,
          lastCheckedAt: plants.lastCheckedAt,
          careMode: plants.careMode,
          waterIntervalSummerDays: plants.waterIntervalSummerDays,
          waterIntervalWinterDays: plants.waterIntervalWinterDays,
        },
        species: {
          commonName: species.commonName,
          commonNameHe: species.commonNameHe,
          scientificName: species.scientificName,
          category: species.category,
          emoji: species.emoji,
          daysToHarvest: species.daysToHarvest,
          wateringFrequencyDays: species.wateringFrequencyDays,
          isPerennial: species.isPerennial,
          harvestMonthStart: species.harvestMonthStart,
          harvestMonthEnd: species.harvestMonthEnd,
          yearsToFirstHarvest: species.yearsToFirstHarvest,
          waterIntervalSummerDays: species.waterIntervalSummerDays,
          waterIntervalWinterDays: species.waterIntervalWinterDays,
        },
        plantedByName: users.displayName,
      })
      .from(plants)
      .innerJoin(species, eq(plants.speciesId, species.id))
      .innerJoin(users, eq(plants.plantedBy, users.id))
      .where(and(ne(plants.status, 'removed'), withinBounds(bounds)))
      // Nearest the middle of the view first, not newest first.
      //
      // The map asks for a box larger than the screen so panning has something
      // to draw. Under a cap, "newest first" spends that budget scattered
      // anywhere in the box — including entirely off-screen — so a dense area
      // could return 200 plants and leave the middle of the screen bare.
      // Distance from the centre spends it on what the user is looking at, and
      // `<->` on the GiST index is an ordered index scan, not a sort.
      .orderBy(sql`${plants.geo} <-> point(${center.lng}, ${center.lat})`)
      .limit(overFetch);

    const all: MapPlant[] = plantRows.map(toMapPlant);
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

/** Candidates to consider before the exact circle test; the box test is indexed. */
const DISTRICT_CANDIDATES = 64;
/** How many districts may feed the count, so one dense patch of cells can't. */
const DISTRICT_LIMIT = 24;
/** Metres per degree of latitude — the same figure `map-bounds.ts` uses. */
const M_PER_DEG_LAT = 111320;

/** `<@ box(...)` against an aliased geo column, OR'd across an antimeridian split. */
function withinBoxes(geo: string, rawBounds: MapBounds): SQL {
  const boxes = splitAntimeridian(normalizeBounds(rawBounds)).map(
    (b) =>
      sql`${sql.raw(geo)} <@ box(point(${b.minLng}, ${b.minLat}), point(${b.maxLng}, ${b.maxLat}))`
  );
  return boxes.length === 1 ? boxes[0] : or(...boxes)!;
}

/**
 * Great-circle metres between two lat/lng expressions, by the spherical law of
 * cosines — the same formula as `metersBetween` in map-bounds.ts, `zones.ts`
 * and the nightly sweep, so every part of the app agrees where a district ends.
 */
function metersSql(aLat: string, aLng: string, bLat: SQL | string, bLng: SQL | string): SQL {
  const [aLatR, aLngR] = [sql.raw(aLat), sql.raw(aLng)];
  const [bLatR, bLngR] = [
    typeof bLat === 'string' ? sql.raw(bLat) : bLat,
    typeof bLng === 'string' ? sql.raw(bLng) : bLng,
  ];
  return sql`(6371000 * acos(least(1, greatest(-1,
    cos(radians(${aLatR})) * cos(radians(${bLatR})) * cos(radians(${bLngR}) - radians(${aLngR}))
    + sin(radians(${aLatR})) * sin(radians(${bLatR}))
  ))))`;
}

/** Does a district's circle reach the viewport? Distance to the nearest point of the box. */
function districtTouchesSql(rawBounds: MapBounds): SQL {
  const parts = splitAntimeridian(normalizeBounds(rawBounds)).map((b) => {
    const nearestLat = sql`least(greatest(z.lat, ${b.minLat}), ${b.maxLat})`;
    const nearestLng = sql`least(greatest(z.lng, ${b.minLng}), ${b.maxLng})`;
    return sql`${metersSql('z.lat', 'z.lng', nearestLat, nearestLng)} <= z.radius_m`;
  });
  return parts.length === 1 ? parts[0] : or(...parts)!;
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
 * One statement, because it used to be two and the second needed the first's
 * answer — and on a serverless driver every query is its own HTTP round trip,
 * so a dependent pair costs twice the latency of the read it runs beside.
 *
 * The three CTEs are the three rules:
 *
 *   in_range   districts whose circle reaches the screen. The box test comes
 *              first because `zones.geo` is GiST-indexed and a circle's reach
 *              is not; widest first, so if a dense patch of grid cells overruns
 *              the cap the districts covering the most ground survive.
 *   innermost  districts that don't swallow another one in range. Zones nest —
 *              a plant in Givat Ada is also in the Haifa District and in Israel
 *              — so without this a street-level view counts a country. Ties
 *              between identical circles break on id, or they'd cancel out and
 *              leave the viewport with no district at all.
 *   counted    plant ids, `union`ed rather than OR'd in one WHERE, so each
 *              branch keeps its own index scan and no plant is counted twice.
 *              The viewport is a branch in its own right: it covers what
 *              districts can't — open country between towns, a zoom wider than
 *              anything in range, and a database whose zones were never seeded,
 *              where this degrades to exactly the old per-viewport count.
 */
export function regionCountStatement(bounds: MapBounds): SQL {
  const reach = expandBounds(bounds, DISTRICT_REACH_M);
  // Half-extents of a district's bounding box, in degrees. Longitude lines
  // converge at the poles, hence the cosine; the floor stops a district at the
  // pole dividing by ~zero. A circle that would wrap past ±180 widens to every
  // longitude instead — over-including is free here, because the exact circle
  // test below throws the extras back out, while clamping would silently cut
  // off the far side of the antimeridian.
  const dLat = sql.raw(`(z.radius_m / ${M_PER_DEG_LAT}.0)`);
  const dLng = sql.raw(
    `(z.radius_m / (${M_PER_DEG_LAT}.0 * greatest(0.01, cos(radians(z.lat)))))`
  );

  return sql`
      with in_range as (
        select z.id, z.lat, z.lng, z.radius_m
        from ${zones} z
        where ${withinBoxes('z.geo', reach)} and ${districtTouchesSql(bounds)}
        order by z.radius_m desc
        limit ${DISTRICT_CANDIDATES}
      ),
      innermost as (
        select z.id, z.lat, z.lng, z.radius_m
        from in_range z
        where not exists (
          select 1
          from in_range inner_z
          where inner_z.id <> z.id
            and (inner_z.radius_m < z.radius_m
                 or (inner_z.radius_m = z.radius_m and inner_z.id < z.id))
            and ${metersSql('z.lat', 'z.lng', 'inner_z.lat', 'inner_z.lng')}
                  + inner_z.radius_m <= z.radius_m
        )
        order by z.radius_m desc
        limit ${DISTRICT_LIMIT}
      ),
      counted as (
        select p.id
        from ${plants} p
        where p.status <> 'removed' and ${withinBoxes('p.geo', bounds)}
        union
        select p.id
        from innermost z
        cross join lateral (
          select
            case when abs(z.lng) + ${dLng} > 180 then -180 else z.lng - ${dLng} end as west,
            case when abs(z.lng) + ${dLng} > 180 then  180 else z.lng + ${dLng} end as east,
            greatest(-90, z.lat - ${dLat}) as south,
            least(90, z.lat + ${dLat}) as north
        ) reach
        join ${plants} p
          on p.geo <@ box(point(reach.west, reach.south), point(reach.east, reach.north))
        where p.status <> 'removed'
          and ${metersSql('p.lat', 'p.lng', 'z.lat', 'z.lng')} <= z.radius_m
      )
      select count(*)::int as n from counted
    `;
}

/**
 * `db.execute` hands back the driver's own shape: an array of rows on
 * neon-http, a pg `Result` on node-postgres. Which client is in play is decided
 * at runtime from the connection string, so accept either.
 */
export function firstRow<T>(result: unknown): T | undefined {
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows;
  return rows?.[0] as T | undefined;
}

export async function getRegionCount(bounds: MapBounds): Promise<number> {
  await connection();
  try {
    const result = await db.execute(regionCountStatement(bounds));
    return Number(firstRow<{ n: number | string }>(result)?.n ?? 0);
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
      x: roundCoord(row.lng, POINT_PRECISION),
      y: roundCoord(row.lat, POINT_PRECISION),
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
