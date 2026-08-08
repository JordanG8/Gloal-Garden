/**
 * The map's regional plant count, checked two ways.
 *
 * The count covers the districts the screen is in range of rather than the
 * screen itself, so zooming in doesn't read as plants disappearing. Three rules
 * decide it, and all three live in one SQL statement (`regionCountStatement` in
 * `data.ts`) because as two round trips the second query needed the first's
 * answer — and on a serverless driver every query is its own HTTP request.
 *
 * SQL that complex deserves a second opinion, so this file keeps an independent
 * JavaScript model of the same three rules:
 *
 *   1. in range   — the district's circle overlaps the viewport
 *   2. innermost  — drop any district that wholly contains another one in range,
 *                   or a street-level view counts a whole country
 *   3. counted    — plants in the viewport, plus plants in those districts,
 *                   each counted once
 *
 * The geometry half runs anywhere. The differential half needs a database, and
 * is skipped without one:
 *
 *   npx tsx scripts/checks/region-count-check.ts
 *   POSTGRES_URL=postgres://... npx tsx scripts/checks/region-count-check.ts
 */

import { and, count, desc, ne, or, sql, type SQL } from 'drizzle-orm';
import {
  DISTRICT_REACH_M,
  expandBounds,
  M_PER_DEG_LAT,
  normalizeBounds,
  splitAntimeridian,
  type MapBounds,
} from '../../src/lib/map-bounds';

let failures = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures += 1;
  }
}

/* ---------------------------------------------------------------- *
 * The model — what the SQL is supposed to mean.
 * ---------------------------------------------------------------- */

/** Just the geometry of a zone row. */
export interface District {
  id: number;
  lat: number;
  lng: number;
  radiusM: number;
}

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Great-circle metres by the spherical law of cosines — the same formula the
 * SQL uses, so a district's edge falls in the same place in both languages.
 * Wrap-safe: it works on the cosine of the longitude *difference*, so 179° and
 * -179° come out 2° apart rather than 358°.
 */
function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const cosine =
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng) - toRad(a.lng)) +
    Math.sin(toRad(a.lat)) * Math.sin(toRad(b.lat));
  return EARTH_RADIUS_M * Math.acos(clamp(cosine, -1, 1));
}

/** Rule 1: does the district's circle reach the viewport? */
function districtTouches(bounds: MapBounds, district: District): boolean {
  return splitAntimeridian(normalizeBounds(bounds)).some((box) => {
    // Closest point of the box to the centre; inside the box that's the centre
    // itself, and the distance comes out zero.
    const nearest = {
      lat: clamp(district.lat, box.minLat, box.maxLat),
      lng: clamp(district.lng, box.minLng, box.maxLng),
    };
    return metersBetween(district, nearest) <= district.radiusM;
  });
}

/** Is `inner` a smaller district lying wholly inside `outer`? */
function swallows(outer: District, inner: District): boolean {
  if (inner.id === outer.id) return false;
  // Two circles of the same size can only contain each other if they're the
  // same circle. Break that tie by id, or they'd cancel each other out and
  // leave the viewport with no district at all.
  if (inner.radiusM > outer.radiusM) return false;
  if (inner.radiusM === outer.radiusM && inner.id > outer.id) return false;
  return metersBetween(inner, outer) + inner.radiusM <= outer.radiusM;
}

/** Rule 2: keep the most specific districts in range. */
function innermostDistricts(districts: District[]): District[] {
  return districts.filter((outer) => !districts.some((inner) => swallows(outer, inner)));
}

/** The box that just contains a district's circle. */
function districtBounds(district: District): MapBounds {
  const latSpan = district.radiusM / M_PER_DEG_LAT;
  const lngSpan =
    district.radiusM / (M_PER_DEG_LAT * Math.max(0.01, Math.cos(toRad(district.lat))));
  return normalizeBounds({
    minLng: district.lng - lngSpan,
    maxLng: district.lng + lngSpan,
    minLat: district.lat - latSpan,
    maxLat: district.lat + latSpan,
  });
}

/* ---------------------------------------------------------------- *
 * Geometry checks — no database needed.
 * ---------------------------------------------------------------- */

// Geometry from migration 0012: a neighbourhood inside a district inside a country.
const givatAda: District = { id: 7, lat: 32.5185, lng: 35.0047, radiusM: 3000 };
const binyamina: District = { id: 8, lat: 32.515, lng: 34.949, radiusM: 3500 };
const haifaDistrict: District = { id: 2, lat: 32.6, lng: 35.0, radiusM: 45000 };
const israel: District = { id: 1, lat: 31.4, lng: 35.0, radiusM: 250000 };
const seeded = [givatAda, binyamina, haifaDistrict, israel];

const inRange = (bounds: MapBounds, candidates = seeded): District[] =>
  innermostDistricts(candidates.filter((d) => districtTouches(bounds, d)));

/** A square viewport of roughly this many degrees, centred on a district. */
const viewOf = (d: District, degrees: number): MapBounds => ({
  minLng: d.lng - degrees / 2,
  maxLng: d.lng + degrees / 2,
  minLat: d.lat - degrees / 2,
  maxLat: d.lat + degrees / 2,
});

console.log('distance is measured the short way round');
check('Givat Ada to Binyamina is about 5 km', Math.abs(metersBetween(givatAda, binyamina) - 5200) < 400);
check(
  'either side of the antimeridian is 2 degrees apart, not 358',
  metersBetween({ lat: 0, lng: 179 }, { lat: 0, lng: -179 }) < 250000
);

console.log('a district covers the same ground however far you zoom in');
// The bug this replaced: the chip counted the viewport, so every zoom step in
// threw plants out of the number. Zooming in leaves the district untouched.
const zoomedIn = [0.05, 0.01, 0.002, 0.0004, 0.00005].map((d) => inRange(viewOf(givatAda, d)));
check(
  'the district you are inside is in range at every zoom',
  zoomedIn.every((list) => list.some((d) => d.id === givatAda.id))
);
check(
  'and from a street down to a single garden it is the only one',
  zoomedIn.slice(1).every((list) => list.length === 1 && list[0].id === givatAda.id)
);
check(
  'a wider view reaches further, rather than the other way round',
  zoomedIn[0].length > zoomedIn[1].length
);

console.log('the widest district in range never swallows the ones inside it');
check('a street view drops the region and the country', inRange(viewOf(givatAda, 0.01)).length === 1);
check(
  'the region alone is kept when nothing smaller is in range',
  inRange({ minLng: 35.2, maxLng: 35.25, minLat: 32.75, maxLat: 32.8 })
    .map((d) => d.id)
    .join() === String(haifaDistrict.id)
);
check(
  'neighbouring towns both survive — overlapping circles are fine',
  inRange({ minLng: 34.94, maxLng: 35.01, minLat: 32.5, maxLat: 32.53 })
    .map((d) => d.id)
    .sort()
    .join() === [givatAda.id, binyamina.id].sort().join()
);
check(
  'identical districts do not cancel each other out',
  innermostDistricts([
    { id: 3, lat: 32.5, lng: 35, radiusM: 4000 },
    { id: 4, lat: 32.5, lng: 35, radiusM: 4000 },
  ]).length === 1
);

console.log('a viewport only reaches districts near it');
const street = viewOf(givatAda, 0.01);
const reach = expandBounds(street, DISTRICT_REACH_M);
const holds = (b: MapBounds, p: { lat: number; lng: number }) =>
  p.lng >= b.minLng && p.lng <= b.maxLng && p.lat >= b.minLat && p.lat <= b.maxLat;
check('the neighbourhood is a candidate', holds(reach, givatAda));
check('so is the district whose centre is 9 km away', holds(reach, haifaDistrict));
check('the country, 120 km away, is not', !holds(reach, israel));
check(
  'and the reach only ever grows the viewport',
  reach.minLat < street.minLat &&
    reach.maxLat > street.maxLat &&
    reach.minLng < street.minLng &&
    reach.maxLng > street.maxLng
);

console.log('a district box contains its circle');
const box = districtBounds(givatAda);
check('the centre is inside', holds(box, givatAda));
check('and so is the northern edge of the circle', box.maxLat >= givatAda.lat + givatAda.radiusM / M_PER_DEG_LAT);
check(
  'a viewport outside the circle does not touch it',
  !districtTouches({ minLng: 35.1, maxLng: 35.12, minLat: 32.6, maxLat: 32.62 }, givatAda)
);

/* ---------------------------------------------------------------- *
 * Differential check — the statement against the model. Needs a database.
 * ---------------------------------------------------------------- */

async function differential() {
  const { db } = await import('../../src/db');
  const { plants, zones } = await import('../../src/db/schema');
  const { firstRow, regionCountStatement } = await import('../../src/lib/data');

  function withinBounds(rawBounds: MapBounds): SQL {
    const boxes = splitAntimeridian(normalizeBounds(rawBounds)).map(
      (b) =>
        sql`${plants.geo} <@ box(point(${b.minLng}, ${b.minLat}), point(${b.maxLng}, ${b.maxLat}))`
    );
    return boxes.length === 1 ? boxes[0] : or(...boxes)!;
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

  /** The model's answer: select districts in JavaScript, then count. */
  async function modelled(bounds: MapBounds): Promise<number> {
    const rows = await db
      .select({ id: zones.id, lat: zones.lat, lng: zones.lng, radiusM: zones.radiusM })
      .from(zones)
      .where(
        (() => {
          const boxes = splitAntimeridian(expandBounds(bounds, DISTRICT_REACH_M)).map(
            (b) =>
              sql`${zones.geo} <@ box(point(${b.minLng}, ${b.minLat}), point(${b.maxLng}, ${b.maxLat}))`
          );
          return boxes.length === 1 ? boxes[0] : or(...boxes)!;
        })()
      )
      .orderBy(desc(zones.radiusM))
      .limit(64);
    const districts = innermostDistricts(rows.filter((d) => districtTouches(bounds, d))).slice(0, 24);
    const [row] = await db
      .select({ n: count() })
      .from(plants)
      .where(
        and(ne(plants.status, 'removed'), or(withinBounds(bounds), ...districts.map(withinDistrict)))
      );
    return Number(row?.n ?? 0);
  }

  const statement = async (bounds: MapBounds): Promise<number> =>
    Number(firstRow<{ n: number | string }>(await db.execute(regionCountStatement(bounds)))?.n ?? 0);

  // A spread of places and scales: inside a town, between towns, in a city, in
  // open country with no zone at all, and either side of the antimeridian.
  const places: [number, number, string][] = [
    [32.5185, 35.0047, 'Givat Ada'],
    [32.515, 34.949, 'Binyamina'],
    [32.475, 34.975, 'Pardes Hanna'],
    [32.794, 34.9896, 'Haifa'],
    [32.0853, 34.7818, 'Tel Aviv'],
    [31.7683, 35.2137, 'Jerusalem'],
    [32.5, 34.5, 'open sea'],
    [31.0, 34.8, 'the Negev'],
    [-18.1, 179.9, 'west of the antimeridian'],
    [-18.1, -179.9, 'east of the antimeridian'],
  ];
  let compared = 0;
  let agreed = 0;
  for (const [lat, lng, label] of places) {
    for (const size of [0.004, 0.02, 0.08, 0.4, 2]) {
      const bounds = normalizeBounds({
        minLng: lng - size / 2,
        maxLng: lng + size / 2,
        minLat: lat - size / 2,
        maxLat: lat + size / 2,
      });
      const [model, actual] = await Promise.all([modelled(bounds), statement(bounds)]);
      compared += 1;
      if (model === actual) agreed += 1;
      else console.error(`  ✗ ${label} ~${size}°: model ${model}, statement ${actual}`);
    }
  }
  check(`the statement matches the model on all ${compared} viewports`, agreed === compared);
}

async function main() {
  if (process.env.POSTGRES_URL || process.env.DATABASE_URL) {
    console.log('the statement agrees with the model');
    await differential();
  } else {
    console.log('the statement agrees with the model');
    console.log('  — skipped, no POSTGRES_URL');
  }

  console.log('');
  if (failures > 0) {
    console.error(`${failures} region count check(s) failed ✗`);
    process.exit(1);
  }
  console.log('All region count checks passed ✓');
}

void main();
