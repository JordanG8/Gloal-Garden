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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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
  return {
    minLng: clamp(minLng, -180, 180),
    minLat: clamp(minLat, -90, 90),
    maxLng: clamp(maxLng, -180, 180),
    maxLat: clamp(maxLat, -90, 90),
  };
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
export function quantizeBounds(bounds: MapBounds, zoom: number): string {
  const step = zoom >= PIN_ZOOM ? 0.005 : zoom >= CLUSTER_ZOOM ? 0.05 : 0.5;
  const down = (n: number) => Math.floor(n / step) * step;
  const up = (n: number) => Math.ceil(n / step) * step;
  return [
    down(bounds.minLng),
    down(bounds.minLat),
    up(bounds.maxLng),
    up(bounds.maxLat),
    Math.floor(zoom),
  ]
    .map((n) => n.toFixed(3))
    .join(',');
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
  return {
    minLng: view.lng - lngSpan / 2,
    maxLng: view.lng + lngSpan / 2,
    minLat: clamp(view.lat - latSpan / 2, -90, 90),
    maxLat: clamp(view.lat + latSpan / 2, -90, 90),
  };
}
