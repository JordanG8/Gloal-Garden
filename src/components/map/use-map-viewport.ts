'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import {
  boundsToParam,
  normalizeBounds,
  pointMatchesFilter,
  quantizeBounds,
  statusToCode,
  tierForZoom,
  PIN_ZOOM,
  VIEW_COOKIE,
  type MapBounds,
  type MapFilter,
  type MapPoint,
  type MapView,
} from '@/lib/map-bounds';
import type { PlantSummary } from '@/lib/types';

/** Long enough that a flick-pan doesn't fire three requests, short enough to feel live. */
const DEBOUNCE_MS = 250;
/** Quantized viewports we've already fetched. Panning back is free. */
const CACHE_LIMIT = 40;

interface Payload {
  tier: 'pins' | 'cluster';
  plants?: PlantSummary[];
  points?: MapPoint[];
  /** Plants across the districts this viewport is in range of. */
  region?: number;
  truncated?: boolean;
  /** Pin-tier only — the cluster read has no way to report a failure. */
  dbReady?: boolean;
}

/** What the last applied payload gave us. */
interface DataState {
  tier: 'pins' | 'cluster';
  plants: PlantSummary[];
  points: MapPoint[];
  region: number;
  truncated: boolean;
  loading: boolean;
  dbReady: boolean;
}

function readBounds(map: MapRef): MapBounds | null {
  try {
    const b = map.getBounds();
    if (!b) return null;
    // MapLibre reports raw, unwrapped longitudes — past the antimeridian these
    // run outside [-180, 180]. Normalize before they reach the cache key or the
    // query string so both sides agree on which patch of earth this is.
    return normalizeBounds({
      minLng: b.getWest(),
      minLat: b.getSouth(),
      maxLng: b.getEast(),
      maxLat: b.getNorth(),
    });
  } catch {
    return null;
  }
}

/** The slim cluster format, derived from summaries we already hold. */
function summaryToPoint(plant: PlantSummary): MapPoint {
  return {
    i: plant.id,
    x: plant.lng,
    y: plant.lat,
    s: statusToCode(plant.status),
    a: plant.upForAdoption ? 1 : 0,
  };
}

/**
 * Keeps the map's data in step with what's actually on screen.
 *
 * The map used to receive every plant in the database as a prop and filter in
 * the browser. This fetches only the current viewport, switching between full
 * plant summaries (close in, where photo pins are legible) and a slim point
 * format (zoomed out, where MapLibre clusters them into dots).
 *
 * Which of the two the map *draws* follows the live zoom, not the last
 * response: the tier flips with the gesture and the data catches up, so
 * zooming out never leaves a screenful of photo pins piled on a city.
 */
export function useMapViewport({
  mapRef,
  filter,
  initial,
  initialView,
}: {
  mapRef: React.RefObject<MapRef | null>;
  filter: MapFilter;
  initial: Pick<DataState, 'plants' | 'region' | 'truncated' | 'dbReady'>;
  initialView: MapView;
}) {
  const [data, setData] = useState<DataState>({
    tier: 'pins',
    plants: initial.plants,
    points: [],
    region: initial.region,
    truncated: initial.truncated,
    loading: false,
    dbReady: initial.dbReady,
  });
  const [liveTier, setLiveTier] = useState<'pins' | 'cluster'>(tierForZoom(initialView.zoom));
  // `onZoom` fires every frame of a pinch. Mirroring the tier in a ref means the
  // hot path is a comparison, not a setState React has to render past before it
  // can bail out — with a screenful of markers, that per-frame render is the
  // stutter this whole change is meant to remove.
  const liveTierRef = useRef(liveTier);

  const cacheRef = useRef(new Map<string, Payload>());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request id. Only the newest request may write to state — a cache
  // hit or a newer fetch resolving first must not be overwritten by an older
  // response that is still in flight.
  const requestRef = useRef(0);
  const lastKeyRef = useRef<string>(
    // Seed with the server-rendered viewport so the first `moveend` (which
    // fires during initial layout) doesn't immediately refetch what we have.
    quantizeBounds(
      {
        minLng: initialView.lng,
        minLat: initialView.lat,
        maxLng: initialView.lng,
        maxLat: initialView.lat,
      },
      initialView.zoom
    ) + ':all'
  );

  const apply = useCallback((payload: Payload) => {
    setData((prev) => ({
      tier: payload.tier,
      plants: payload.tier === 'pins' ? (payload.plants ?? []) : prev.plants,
      points: payload.tier === 'cluster' ? (payload.points ?? []) : [],
      region: payload.region ?? prev.region,
      truncated: payload.truncated ?? false,
      loading: false,
      // A database that fell over after the first paint has to be able to say
      // so. Without this the route's `dbReady: false` was dropped on the floor
      // and an outage rendered as an empty viewport — which the map then
      // explained with "plant your first plant".
      dbReady: payload.dbReady ?? prev.dbReady,
    }));
  }, []);

  const fetchViewport = useCallback(
    async (bounds: MapBounds, zoom: number, force = false) => {
      const key = `${quantizeBounds(bounds, zoom)}:${zoom < PIN_ZOOM ? 'cluster' : filter}`;
      if (!force && key === lastKeyRef.current) return;
      lastKeyRef.current = key;

      // Claim the newest slot and drop anything still in flight, cache hit or
      // not: without this, panning onto a cached viewport leaves the previous
      // request running, and its late response repaints the map with pins from
      // a viewport the user has already left.
      const seq = ++requestRef.current;
      abortRef.current?.abort();
      abortRef.current = null;

      const cached = cacheRef.current.get(key);
      if (cached) {
        apply(cached);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setData((prev) => ({ ...prev, loading: true }));

      try {
        const params = new URLSearchParams({
          bbox: boundsToParam(bounds),
          zoom: String(zoom),
          filter,
        });
        const res = await fetch(`/api/map?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`map fetch failed: ${res.status}`);
        const payload: Payload = await res.json();
        if (seq !== requestRef.current) return;

        if (cacheRef.current.size >= CACHE_LIMIT) {
          // Cheap FIFO eviction — the oldest key is the first one iterated.
          const oldest = cacheRef.current.keys().next().value;
          if (oldest !== undefined) cacheRef.current.delete(oldest);
        }
        cacheRef.current.set(key, payload);
        apply(payload);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Map viewport fetch failed:', error);
        // Forget the key we optimistically claimed. It holds no data, so
        // leaving it as "current" would make this viewport unretryable —
        // nudging the map back here would match the key and skip the fetch,
        // stranding the user on whatever was last drawn.
        if (lastKeyRef.current === key) lastKeyRef.current = '';
        if (seq === requestRef.current) setData((prev) => ({ ...prev, loading: false }));
      }
    },
    [filter, apply]
  );

  /** Call from the map's `onMoveEnd`. Debounced and viewport-cached. */
  const onViewportChange = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = readBounds(map);
    if (!bounds) return;
    const zoom = map.getZoom();
    const center = map.getCenter();

    // Remember where we are, so the next server render starts here rather than
    // in Givat Ada. Lax + a year: it's a viewport, not a credential.
    document.cookie = `${VIEW_COOKIE}=${center.lat.toFixed(5)},${center.lng.toFixed(
      5
    )},${zoom.toFixed(1)}; path=/; max-age=31536000; samesite=lax`;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void fetchViewport(bounds, zoom), DEBOUNCE_MS);
  }, [mapRef, fetchViewport]);

  /** Call from the map's `onZoom`. Flips the drawn tier mid-gesture. */
  const onZoomChange = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = tierForZoom(map.getZoom());
    if (liveTierRef.current === next) return;
    liveTierRef.current = next;
    setLiveTier(next);
  }, [mapRef]);

  // Changing the filter must refetch the same viewport, since filtering now
  // happens server-side against the whole viewport rather than the loaded page.
  const filterRef = useRef(filter);
  useEffect(() => {
    if (filterRef.current === filter) return;
    filterRef.current = filter;
    const map = mapRef.current;
    if (!map) return;
    const bounds = readBounds(map);
    if (bounds) void fetchViewport(bounds, map.getZoom(), true);
  }, [filter, mapRef, fetchViewport]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // Photo pins only once we hold summaries for this zoom. Zooming in from the
  // cluster tier keeps the dots on screen until the pins arrive, which beats
  // both a blank map and a flash of pins from the previous viewport.
  const showPins = liveTier === 'pins' && data.tier === 'pins';

  // Zoomed out before the cluster payload lands, cluster the summaries we
  // already have. Same plants, same coordinates — just drawn as dots.
  const points = useMemo(() => {
    const source = data.tier === 'cluster' ? data.points : data.plants.map(summaryToPoint);
    return filter === 'all' ? source : source.filter((p) => pointMatchesFilter(p, filter));
  }, [data.tier, data.points, data.plants, filter]);

  return {
    showPins,
    plants: data.plants,
    points,
    region: data.region,
    truncated: showPins && data.truncated,
    loading: data.loading,
    dbReady: data.dbReady,
    onViewportChange,
    onZoomChange,
  };
}
