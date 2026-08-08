import type { PlantStatus } from './plant-status';

/**
 * Viewport plumbing shared by the map client, the `/api/map` route handler and
 * the server-rendered first paint. Kept dependency-free so the client bundle
 * doesn't drag in anything server-only.
 */

export interface MapBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/** Single source of truth — these were duplicated across three files. */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
export const FALLBACK_CENTER = { lat: 32.5185, lng: 35.0047 }; // Givat Ada
export const DEFAULT_ZOOM = 16;

/** Cookie the map writes on move so the next server render starts where you left off. */
export const VIEW_COOKIE = 'gg_view';

/**
 * Below this the map shows aggregates rather than plants. 15.5 is roughly
 * "one street fills the screen", which is the first zoom where a 68px photo
 * pin is legible rather than a pile.
 */
export const PIN_ZOOM = 15.5;
/** Between CLUSTER_ZOOM and PIN_ZOOM the map draws clustered dots. */
export const CLUSTER_ZOOM = 12;

/**
 * Which tier a zoom level belongs to. Shared so the client can switch what it
 * draws the instant the gesture crosses the threshold, rather than waiting for
 * the matching payload — otherwise a zoom-out leaves 200 photo pins piled on a
 * city-wide view for a debounce plus a round trip.
 */
export function tierForZoom(zoom: number): 'pins' | 'cluster' {
  return Number.isFinite(zoom) && zoom < PIN_ZOOM ? 'cluster' : 'pins';
}

/** Hard caps so a pathological viewport can never return an unbounded set. */
export const PIN_LIMIT = 200;
export const CLUSTER_LIMIT = 3000;

/**
 * Status as a small integer, because the cluster tier ships one of these per
 * plant and the strings are ~10x the bytes. Order is stable — appending is
 * safe, reordering is not.
 */
export const STATUS_CODES = [
  'growing',
  'needs_water',
  'ready_to_harvest',
  'needs_attention',
  'diseased',
  'dormant',
  'removed',
] as const;

export function statusToCode(status: PlantStatus): number {
  const index = STATUS_CODES.indexOf(status as (typeof STATUS_CODES)[number]);
  return index === -1 ? 0 : index;
}

export function codeToStatus(code: number): PlantStatus {
  return (STATUS_CODES[code] ?? 'growing') as PlantStatus;
}

/** The cluster tier's wire format: id, lng, lat, status code, up-for-adoption. */
export interface MapPoint {
  i: number;
  x: number;
  y: number;
  s: number;
  /** 1 when the plant needs a steward — the map colours these distinctly. */
  a: 0 | 1;
}

/**
 * The map's filter chips. Declared here rather than in `data.ts` so client
 * code can use them at runtime — `data.ts` is `server-only`, so importing a
 * *value* from it would break the browser bundle.
 */
export type MapFilter = 'all' | 'water' | 'harvest' | 'steward' | 'trouble';

/**
 * The same predicate as `matchesFilter` in data.ts, against the slim wire
 * format. The cluster tier is filtered in the browser: the points already carry
 * status and adoption state, so a chip tap can repaint immediately instead of
 * refetching a viewport the server would return unfiltered anyway.
 */
export function pointMatchesFilter(point: MapPoint, filter: MapFilter): boolean {
  switch (filter) {
    case 'water':
      return codeToStatus(point.s) === 'needs_water';
    case 'harvest':
      return codeToStatus(point.s) === 'ready_to_harvest';
    case 'steward':
      return point.a === 1;
    case 'trouble': {
      const status = codeToStatus(point.s);
      return status === 'needs_attention' || status === 'diseased';
    }
    default:
      return true;
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Folds an out-of-range longitude back into [-180, 180]. 181 → -179, -181 → 179. */
const wrapLng = (lng: number) => {
  if (lng >= -180 && lng <= 180) return lng;
  return ((((lng + 180) % 360) + 360) % 360) - 180;
};

/**
 * Puts a viewport into the form the query builder expects.
 *
 * MapLibre pans horizontally without limit, so `getBounds()` happily returns
 * longitudes outside [-180, 180] — 179 → 181 after crossing the antimeridian,
 * and arbitrarily large values once you keep dragging west. Clamping those
 * into range collapses the box (181 becomes 180, so 179→181 becomes an
 * 0.0-wide strip and every plant vanishes); wrapping preserves it and hands
 * `splitAntimeridian` the `minLng > maxLng` form it already knows how to cut
 * in two. A viewport wider than the world just becomes the world.
 */
export function normalizeBounds(bounds: MapBounds): MapBounds {
  const minLat = clamp(Math.min(bounds.minLat, bounds.maxLat), -90, 90);
  const maxLat = clamp(Math.max(bounds.minLat, bounds.maxLat), -90, 90);
  if (bounds.maxLng - bounds.minLng >= 360) {
    return { minLng: -180, maxLng: 180, minLat, maxLat };
  }
  return {
    minLng: wrapLng(bounds.minLng),
    maxLng: wrapLng(bounds.maxLng),
    minLat,
    maxLat,
  };
}

/**
 * Parses a `minLng,minLat,maxLng,maxLat` string (the order MapLibre's
 * `getBounds().toArray().flat()` produces). Returns null rather than throwing
 * so callers can fall back instead of 500ing on a malformed query string.
 */
export function parseBounds(raw: string | null): MapBounds | null {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  return normalizeBounds({ minLng, minLat, maxLng, maxLat });
}

/**
 * A viewport that crosses the antimeridian arrives with minLng > maxLng (e.g.
 * Fiji: 179 → -179). A single `box()` would be empty, silently hiding every
 * plant. Split it into two boxes that the caller ORs together.
 */
export function splitAntimeridian(bounds: MapBounds): MapBounds[] {
  if (bounds.minLng <= bounds.maxLng) return [bounds];
  return [
    { ...bounds, minLng: bounds.minLng, maxLng: 180 },
    { ...bounds, minLng: -180, maxLng: bounds.maxLng },
  ];
}

/**
 * Snaps a viewport outward to a grid so small pans reuse the previous result
 * instead of refetching. Coarser at low zoom, where a degree covers more pixels.
 */
export function snapBounds(bounds: MapBounds, zoom: number): MapBounds {
  const step = zoom >= PIN_ZOOM ? 0.005 : zoom >= CLUSTER_ZOOM ? 0.05 : 0.5;
  const down = (n: number) => Math.floor(n / step) * step;
  const up = (n: number) => Math.ceil(n / step) * step;
  return normalizeBounds({
    minLng: down(bounds.minLng),
    minLat: down(bounds.minLat),
    maxLng: up(bounds.maxLng),
    maxLat: up(bounds.maxLat),
  });
}

/**
 * The snapped box as a cache key. Sent on the wire too, not just held locally:
 * a continuous bbox gives every visitor a URL nobody else will ever request,
 * while a snapped one repeats — across a pan, across a session, across people
 * looking at the same town — which is what makes the response worth caching at
 * the edge at all.
 */
export function quantizeBounds(bounds: MapBounds, zoom: number): string {
  const snapped = snapBounds(bounds, zoom);
  return [snapped.minLng, snapped.minLat, snapped.maxLng, snapped.maxLat, Math.floor(zoom)]
    .map((n) => n.toFixed(3))
    .join(',');
}

/**
 * Coordinates as sent to the browser.
 *
 * `doublePrecision` round-trips as its full decimal expansion —
 * `34.96501601483604`, seventeen characters to place a dot. Six decimals is
 * ~11 cm and five is ~1.1 m, which is finer than a pin is wide and far finer
 * than a cluster bubble. At three thousand points on a town-wide view the
 * difference is a third of the payload, spent on digits no one can see.
 */
export const PIN_PRECISION = 6;
export const POINT_PRECISION = 5;

export function roundCoord(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function boundsToParam(bounds: MapBounds): string {
  return `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`;
}

export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

/** Parses the `lat,lng,zoom` view cookie, falling back when it's absent or junk. */
export function parseView(raw: string | undefined): MapView {
  const parts = raw?.split(',').map(Number) ?? [];
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return { ...FALLBACK_CENTER, zoom: DEFAULT_ZOOM };
  }
  const [lat, lng, zoom] = parts;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ...FALLBACK_CENTER, zoom: DEFAULT_ZOOM };
  }
  return { lat, lng, zoom: clamp(zoom, 1, 22) };
}

/**
 * Approximate bounds for a viewport centred on a point. Only used for the
 * server-rendered first paint — the client sends real bounds from
 * `map.getBounds()` as soon as it has laid out. Deliberately generous so the
 * first paint doesn't show a half-empty map that then fills in.
 */
export function boundsAround(view: MapView, aspect = 0.6): MapBounds {
  // Degrees of longitude visible at a given zoom for a ~1000px-wide viewport.
  const lngSpan = 360 / Math.pow(2, view.zoom) * 3;
  const latSpan = lngSpan * aspect * Math.cos((view.lat * Math.PI) / 180);
  return normalizeBounds({
    minLng: view.lng - lngSpan / 2,
    maxLng: view.lng + lngSpan / 2,
    minLat: view.lat - latSpan / 2,
    maxLat: view.lat + latSpan / 2,
  });
}

/**
 * How far past the edge of the screen the map loads.
 *
 * Fetching exactly what's visible means the first pixel of a pan has nothing to
 * draw: a plant one pixel off-screen was never loaded, so it can't slide into
 * view. A margin means most pans are already paid for — the pins are in memory
 * before they're needed, and no request is made at all.
 *
 * 0.4 of the viewport on every side: 1.8× the width and height, a bit over 3×
 * the area. Enough to cover a fast flick without asking the database for a
 * county.
 */
export const PAN_MARGIN = 0.4;

/** Grows a viewport by a fraction of its own width and height on each side. */
export function padBounds(bounds: MapBounds, fraction = PAN_MARGIN): MapBounds {
  const box = normalizeBounds(bounds);
  // A box that wraps the antimeridian has minLng > maxLng; its true width is
  // the walk east from min to max, which is 360 short of the raw difference.
  const width = box.maxLng >= box.minLng ? box.maxLng - box.minLng : box.maxLng - box.minLng + 360;
  const height = box.maxLat - box.minLat;
  return normalizeBounds({
    minLng: box.minLng - width * fraction,
    maxLng: box.maxLng + width * fraction,
    minLat: box.minLat - height * fraction,
    maxLat: box.maxLat + height * fraction,
  });
}

/** The middle of a viewport, walking east across the antimeridian if it wraps. */
export function boundsCenter(bounds: MapBounds): { lat: number; lng: number } {
  const box = normalizeBounds(bounds);
  const lng =
    box.maxLng >= box.minLng
      ? (box.minLng + box.maxLng) / 2
      : wrapLng((box.minLng + box.maxLng + 360) / 2);
  return { lat: (box.minLat + box.maxLat) / 2, lng };
}

/** Is this point inside the viewport? */
export function boundsContain(bounds: MapBounds, point: { lat: number; lng: number }): boolean {
  return splitAntimeridian(normalizeBounds(bounds)).some(
    (box) =>
      point.lng >= box.minLng &&
      point.lng <= box.maxLng &&
      point.lat >= box.minLat &&
      point.lat <= box.maxLat
  );
}

/**
 * Does `outer` fully contain `inner`? The map uses this to skip a fetch
 * entirely: if the viewport is still inside what's already loaded, the pins for
 * it are in memory and there is nothing to ask for.
 */
export function boundsCover(outer: MapBounds, inner: MapBounds): boolean {
  const o = normalizeBounds(outer);
  const i = normalizeBounds(inner);
  if (i.minLat < o.minLat || i.maxLat > o.maxLat) return false;
  // Compare longitudes as offsets walking east from the outer box's west edge,
  // so a pair that straddles the antimeridian compares as one continuous span.
  const east = (from: number, to: number) => (((to - from) % 360) + 360) % 360;
  const outerWidth = o.maxLng >= o.minLng ? o.maxLng - o.minLng : east(o.minLng, o.maxLng);
  if (outerWidth >= 360) return true;
  const innerStart = east(o.minLng, i.minLng);
  const innerWidth = i.maxLng >= i.minLng ? i.maxLng - i.minLng : east(i.minLng, i.maxLng);
  return innerStart + innerWidth <= outerWidth + 1e-9;
}

/* ------------------------------------------------------------------ *
 * Districts
 *
 * The plant count on the map is *regional*, not per-viewport: it covers the
 * districts the screen is in range of, so zooming into a street doesn't make
 * the neighbourhood's plants disappear from the tally. A district is a `zones`
 * row — a circle with a centre and a radius, same shape the zone directory and
 * the care sweep count against, so the two agree.
 * ------------------------------------------------------------------ */

/** Just the geometry of a zone; the map never needs the rest of the row. */
export interface District {
  id: number;
  lat: number;
  lng: number;
  radiusM: number;
}

const EARTH_RADIUS_M = 6371000;
/** Metres per degree of latitude. Varies by ~0.3%, which no bounding box cares about. */
const M_PER_DEG_LAT = 111320;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle metres between two points, by the spherical law of cosines —
 * deliberately the same formula the SQL in `zones.ts` and the care sweep use,
 * so a district's edge falls in exactly the same place in both languages.
 *
 * Wrap-safe: it works on the cosine of the longitude *difference*, so a point
 * at 179° and one at -179° come out 2° apart rather than 358°.
 */
export function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const cosine =
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng) - toRad(a.lng)) +
    Math.sin(toRad(a.lat)) * Math.sin(toRad(b.lat));
  return EARTH_RADIUS_M * Math.acos(clamp(cosine, -1, 1));
}

/** Degrees of longitude in a given distance at a given latitude. */
function lngDegrees(meters: number, lat: number): number {
  // Longitude lines converge at the poles, so a metre is worth more degrees the
  // further north you go. The floor stops a district at the pole from asking
  // for a division by ~zero; normalizeBounds turns the result into the world.
  return meters / (M_PER_DEG_LAT * Math.max(0.01, Math.cos(toRad(lat))));
}

/**
 * The box that just contains a district's circle. Used as an index-friendly
 * pre-filter in front of the exact distance test — `plants.geo` has a GiST
 * index, and `acos(...)` on every row does not.
 */
export function districtBounds(district: District): MapBounds {
  const latSpan = district.radiusM / M_PER_DEG_LAT;
  const lngSpan = lngDegrees(district.radiusM, district.lat);
  return normalizeBounds({
    minLng: district.lng - lngSpan,
    maxLng: district.lng + lngSpan,
    minLat: district.lat - latSpan,
    maxLat: district.lat + latSpan,
  });
}

/** Grows a viewport by a distance on every side. */
export function expandBounds(bounds: MapBounds, meters: number): MapBounds {
  const box = normalizeBounds(bounds);
  const latSpan = meters / M_PER_DEG_LAT;
  // Widen by the worst case within the box: the edge nearest a pole, where a
  // metre buys the most longitude.
  const lngSpan = lngDegrees(meters, Math.max(Math.abs(box.minLat), Math.abs(box.maxLat)));
  return normalizeBounds({
    minLng: box.minLng - lngSpan,
    maxLng: box.maxLng + lngSpan,
    minLat: box.minLat - latSpan,
    maxLat: box.maxLat + latSpan,
  });
}

/**
 * How far outside the viewport a district's centre may sit and still be in
 * range. Comfortably past a city radius, so panning to the edge of town still
 * counts the town. A district wider than this only joins once you're zoomed out
 * far enough to have its centre on screen — which is the zoom at which a region
 * or a country is the right unit to be counting anyway.
 */
export const DISTRICT_REACH_M = 30000;

/** Does a district's circle overlap the viewport? */
export function districtTouches(bounds: MapBounds, district: District): boolean {
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

/**
 * Keeps the most specific districts in range.
 *
 * Zones nest — a plant in Givat Ada is also in the Haifa District and in
 * Israel — so "everything the viewport touches" would hand back the country
 * and count every plant in it from a street-level view. Dropping any district
 * that wholly contains another one in range leaves the tightest cover of what's
 * on screen. Circles that merely overlap are all kept: the count is one pass
 * over plants, so an overlap can't count anything twice.
 */
export function innermostDistricts(districts: District[]): District[] {
  return districts.filter((outer) => !districts.some((inner) => swallows(outer, inner)));
}
