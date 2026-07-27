/**
 * Assertions for the viewport math behind the map.
 *
 * The one that matters is longitude wrapping. MapLibre pans horizontally
 * without limit, so `getBounds()` returns raw, unwrapped longitudes: cross the
 * antimeridian eastbound and a viewport reads 179 → 181. The old code
 * *clamped* into [-180, 180], which turned that into 179 → 180 — a sliver of
 * the screen — and a viewport further out into 180 → 180, an empty box that
 * hides every plant on it. Wrapping instead produces the `minLng > maxLng`
 * form `splitAntimeridian` already cuts into two boxes.
 *
 *   npx tsx scripts/checks/map-viewport-check.ts
 */

import {
  boundsToParam,
  normalizeBounds,
  parseBounds,
  pointMatchesFilter,
  splitAntimeridian,
  statusToCode,
  tallyPoints,
  tierForZoom,
  PIN_ZOOM,
  type MapBounds,
  type MapPoint,
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

/** Total longitude covered by a viewport once split into real boxes. */
function lngCoverage(bounds: MapBounds): number {
  return splitAntimeridian(normalizeBounds(bounds)).reduce(
    (total, box) => total + (box.maxLng - box.minLng),
    0
  );
}

/** Field-by-field equality — key order differs between literals and returns. */
function sameBounds(a: MapBounds, b: MapBounds): boolean {
  return (
    a.minLng === b.minLng && a.maxLng === b.maxLng && a.minLat === b.minLat && a.maxLat === b.maxLat
  );
}

/** Does a plant at this longitude fall inside the viewport? */
function covers(bounds: MapBounds, lng: number, lat = 0): boolean {
  return splitAntimeridian(normalizeBounds(bounds)).some(
    (box) => lng >= box.minLng && lng <= box.maxLng && lat >= box.minLat && lat <= box.maxLat
  );
}

console.log('an ordinary viewport is left alone');
const givatAda: MapBounds = { minLng: 34.98, minLat: 32.5, maxLng: 35.03, maxLat: 32.54 };
const normalized = normalizeBounds(givatAda);
check('bounds inside range pass through unchanged', sameBounds(normalized, givatAda));
check('and cover their own plants', covers(givatAda, 35.0, 32.52));
check('normalizing twice changes nothing', sameBounds(normalizeBounds(normalized), normalized));

console.log('crossing the antimeridian eastbound');
// Suva, Fiji: the screen straddles 180, so MapLibre reports 179 → 181.
const fijiEast: MapBounds = { minLng: 179, minLat: -18.2, maxLng: 181, maxLat: -18.0 };
check('the viewport still spans its full 2 degrees', Math.abs(lngCoverage(fijiEast) - 2) < 1e-9);
check('a plant just east of the line is inside', covers(fijiEast, -179.5, -18.1));
check('a plant just west of the line is inside', covers(fijiEast, 179.5, -18.1));
check('a plant on the other side of the world is not', !covers(fijiEast, 0, -18.1));

console.log('crossing the antimeridian westbound');
// The same screen reached by dragging west instead: -181 → -179.
const fijiWest: MapBounds = { minLng: -181, minLat: -18.2, maxLng: -179, maxLat: -18.0 };
check('the viewport still spans its full 2 degrees', Math.abs(lngCoverage(fijiWest) - 2) < 1e-9);
check('a plant just west of the line is inside', covers(fijiWest, 179.5, -18.1));
check('a plant just east of the line is inside', covers(fijiWest, -179.5, -18.1));

console.log('after dragging the map around the world a few times');
// Longitudes grow without bound; +720 is the same place, two laps later.
const looped: MapBounds = { minLng: 34.98 + 720, minLat: 32.5, maxLng: 35.03 + 720, maxLat: 32.54 };
check('the viewport keeps its width', Math.abs(lngCoverage(looped) - 0.05) < 1e-9);
check('and still covers Givat Ada', covers(looped, 35.0, 32.52));

console.log('the failure this replaced');
// Clamping is what shipped before: `Math.min(180, Math.max(-180, lng))`.
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clamped = {
  minLng: clamp(fijiEast.minLng, -180, 180),
  maxLng: clamp(fijiEast.maxLng, -180, 180),
  minLat: fijiEast.minLat,
  maxLat: fijiEast.maxLat,
};
check('clamping dropped half the viewport', clamped.maxLng - clamped.minLng < 2);
check('clamping hid the plants east of the line', !(-179.5 >= clamped.minLng && -179.5 <= clamped.maxLng));
const clampedLoop = { ...looped, minLng: 180, maxLng: 180 };
check('and a looped viewport collapsed to nothing', clampedLoop.maxLng - clampedLoop.minLng === 0);

console.log('a viewport wider than the world becomes the world');
const whole = normalizeBounds({ minLng: -400, minLat: -80, maxLng: 400, maxLat: 80 });
check('spans -180..180', whole.minLng === -180 && whole.maxLng === 180);
check('is a single box', splitAntimeridian(whole).length === 1);

console.log('the wire format survives a round trip');
for (const bounds of [givatAda, fijiEast, fijiWest, looped]) {
  const round = parseBounds(boundsToParam(normalizeBounds(bounds)));
  check(
    `${boundsToParam(bounds)} → ${round ? boundsToParam(round) : 'null'}`,
    round !== null && Math.abs(lngCoverage(round) - lngCoverage(bounds)) < 1e-9
  );
}
check('junk falls back to null rather than the Gulf of Guinea', parseBounds('not,a,bbox,at') === null);
check('a missing bbox is null too', parseBounds(null) === null);

console.log('inverted latitudes are righted, not silently empty');
const upsideDown = normalizeBounds({ minLng: 34.98, minLat: 32.54, maxLng: 35.03, maxLat: 32.5 });
check('min/max swap back', upsideDown.minLat === 32.5 && upsideDown.maxLat === 32.54);

console.log('the tier follows the zoom, not the payload');
check('a city-wide view clusters', tierForZoom(12) === 'cluster');
check('just under the threshold still clusters', tierForZoom(PIN_ZOOM - 0.01) === 'cluster');
check('the threshold itself draws pins', tierForZoom(PIN_ZOOM) === 'pins');
check('a street-level view draws pins', tierForZoom(18) === 'pins');

console.log('the chips count what the cluster tier is showing');
const point = (s: string, adoptable = false): MapPoint => ({
  i: Math.random(),
  x: 35,
  y: 32,
  s: statusToCode(s as Parameters<typeof statusToCode>[0]),
  a: adoptable ? 1 : 0,
});
const points = [
  point('needs_water'),
  point('needs_water'),
  point('ready_to_harvest'),
  point('needs_attention'),
  point('diseased'),
  point('growing', true),
  point('growing'),
];
const counts = tallyPoints(points);
check('all', counts.all === 7);
check('water', counts.water === 2);
check('harvest', counts.harvest === 1);
check('trouble counts both needs_attention and diseased', counts.trouble === 2);
check('steward counts up-for-adoption', counts.steward === 1);
check(
  'filtering agrees with the tally',
  points.filter((p) => pointMatchesFilter(p, 'water')).length === counts.water &&
    points.filter((p) => pointMatchesFilter(p, 'trouble')).length === counts.trouble &&
    points.filter((p) => pointMatchesFilter(p, 'steward')).length === counts.steward
);
check("'all' keeps everything", points.filter((p) => pointMatchesFilter(p, 'all')).length === 7);

console.log('');
if (failures > 0) {
  console.error(`${failures} map viewport check(s) failed ✗`);
  process.exit(1);
}
console.log('All map viewport checks passed ✓');
