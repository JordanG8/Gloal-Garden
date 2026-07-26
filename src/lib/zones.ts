import { db } from '@/db';
import { zones } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Which community does a point belong to?
 *
 * Not marked `server-only`: scripts/seed.ts needs the same resolution the app
 * uses, and duplicating it there would let the two drift.
 *
 * Named zones are seeded (see migration 0012). Anything outside all of them —
 * which is most of the planet — falls into a lazily-created grid cell, so a
 * plant dropped anywhere still has somewhere to talk about it.
 *
 * The cell key is integer arithmetic on the coordinates rather than a geohash,
 * deliberately: it's computable in SQL and in JS with no library, so a backfill
 * and a live insert agree without one of them needing to run in Node.
 */

/**
 * 20 steps per degree ≈ 5.5 km east-west, 4.7 km north-south at Israel's
 * latitude. Comparable to a geohash-5 cell, and legible in a slug.
 */
const CELL_STEPS_PER_DEGREE = 20;

export function cellIndices(lat: number, lng: number): { latIdx: number; lngIdx: number } {
  return {
    latIdx: Math.floor(lat * CELL_STEPS_PER_DEGREE),
    lngIdx: Math.floor(lng * CELL_STEPS_PER_DEGREE),
  };
}

export function cellSlug(lat: number, lng: number): string {
  const { latIdx, lngIdx } = cellIndices(lat, lng);
  // Negative indices would give a slug with a hyphen in the middle, which reads
  // like a separator. `n`/`s`/`e`/`w` keeps it unambiguous.
  const ns = latIdx >= 0 ? `n${latIdx}` : `s${Math.abs(latIdx)}`;
  const ew = lngIdx >= 0 ? `e${lngIdx}` : `w${Math.abs(lngIdx)}`;
  return `cell-${ns}-${ew}`;
}

/** Centre of the cell containing this point. */
export function cellCenter(lat: number, lng: number): { lat: number; lng: number } {
  const { latIdx, lngIdx } = cellIndices(lat, lng);
  const half = 0.5 / CELL_STEPS_PER_DEGREE;
  return {
    lat: latIdx / CELL_STEPS_PER_DEGREE + half,
    lng: lngIdx / CELL_STEPS_PER_DEGREE + half,
  };
}

/** A readable placeholder name a mod can replace. */
function cellName(lat: number, lng: number): string {
  const center = cellCenter(lat, lng);
  return `Near ${center.lat.toFixed(2)}, ${center.lng.toFixed(2)}`;
}

/**
 * The most specific seeded zone containing a point, or null.
 *
 * Ordered so a neighbourhood wins over the city that contains it, and the city
 * over the region — you want to talk to your street before your district, and
 * the hierarchy makes the wider feeds reachable anyway.
 *
 * This is a sequential scan over the official zones, and deliberately so:
 * there are a couple of dozen of them, each row carries its own radius (so a
 * single index-friendly bounding box doesn't exist), and correctness here is
 * worth more than an index on a table this size. If the seeded list ever grows
 * past a few hundred, switch to real polygons with `poly_ops` GiST.
 */
async function findOfficialZone(lat: number, lng: number): Promise<number | null> {
  const [row] = await db
    .select({ id: zones.id })
    .from(zones)
    .where(
      // Degrees per metre varies with latitude, so compare in metres via the
      // spherical-law-of-cosines distance rather than pretending 1 degree is
      // constant. `<@ circle` on raw degrees would stretch zones east-west.
      sql`${zones.isOfficial} = 1 and (
        6371000 * acos(
          least(1, greatest(-1,
            cos(radians(${lat})) * cos(radians(${zones.lat}))
              * cos(radians(${zones.lng}) - radians(${lng}))
            + sin(radians(${lat})) * sin(radians(${zones.lat}))
          ))
        )
      ) <= ${zones.radiusM}`
    )
    .orderBy(
      sql`case ${zones.kind}
            when 'neighborhood' then 0
            when 'city' then 1
            when 'region' then 2
            else 3 end`,
      sql`${zones.radiusM} asc`
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * Resolve a point to a zone id, creating the fallback cell if needed.
 *
 * Deliberately only reachable as a side effect of creating something real (a
 * plant, a post) — never from a user-facing "make a zone" button, which would
 * let anyone litter the directory with empty communities. Cells are created
 * `is_official = 0` and stay out of the zone directory until they have
 * something in them.
 */
export async function resolveZoneId(lat: number, lng: number): Promise<number | null> {
  try {
    const official = await findOfficialZone(lat, lng);
    if (official !== null) return official;

    const slug = cellSlug(lat, lng);
    const [existing] = await db
      .select({ id: zones.id })
      .from(zones)
      .where(eq(zones.slug, slug))
      .limit(1);
    if (existing) return existing.id;

    const center = cellCenter(lat, lng);
    const [created] = await db
      .insert(zones)
      .values({
        slug,
        name: cellName(lat, lng),
        kind: 'cell',
        lat: center.lat,
        lng: center.lng,
        // Half the diagonal of the cell, so the circle covers its corners.
        radiusM: Math.round((111320 / CELL_STEPS_PER_DEGREE) * 0.75),
        isOfficial: 0,
      })
      // Two people planting in the same empty cell at once is a real race.
      .onConflictDoNothing({ target: zones.slug })
      .returning({ id: zones.id });
    if (created) {
      // A cell has no parent to inherit from, so it is its own ancestry.
      await db
        .update(zones)
        .set({ ancestorIds: [created.id] })
        .where(eq(zones.id, created.id));
      return created.id;
    }

    // Lost the race — the other writer's row is there now.
    const [raced] = await db
      .select({ id: zones.id })
      .from(zones)
      .where(eq(zones.slug, slug))
      .limit(1);
    return raced?.id ?? null;
  } catch (error) {
    // A post without a zone is still a post; never block writing on this.
    console.error('resolveZoneId failed:', error);
    return null;
  }
}
