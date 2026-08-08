'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import {
  boundsAround,
  boundsContain,
  boundsCover,
  boundsToParam,
  normalizeBounds,
  padBounds,
  pointMatchesFilter,
  quantizeBounds,
  snapBounds,
  statusToCode,
  tierForZoom,
  VIEW_COOKIE,
  type MapBounds,
  type MapFilter,
  type MapPoint,
  type MapView,
} from '@/lib/map-bounds';
import type { MapPlant } from '@/lib/types';

/**
 * Long enough that a flick-pan doesn't fire three requests, short enough to
 * feel live. Shorter than it used to be: with a loaded margin around the
 * viewport, most moves no longer fetch at all, so the ones that do are worth
 * starting promptly.
 */
const DEBOUNCE_MS = 120;
/** Quantized viewports we've already fetched. Panning back is free. */
const CACHE_LIMIT = 40;
/**
 * How many pins may be held at once. Merging keeps plants from previous
 * viewports on screen, so without a ceiling a long pan would accumulate every
 * plant it ever walked past. Comfortably above one screenful plus its margin.
 */
const PLANT_CAP = 600;

interface Payload {
  tier: 'pins' | 'cluster';
  plants?: MapPlant[];
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
  plants: MapPlant[];
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

/** The slim cluster format, derived from pins we already hold. */
function pinToPoint(plant: MapPlant): MapPoint {
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
 * the browser. This fetches only what's near the viewport, switching between
 * pin summaries (close in, where photo pins are legible) and a slim point
 * format (zoomed out, where MapLibre clusters them into dots).
 *
 * Which of the two the map *draws* follows the live zoom, not the last
 * response: the tier flips with the gesture and the data catches up, so
 * zooming out never leaves a screenful of photo pins piled on a city.
 *
 * Panning is deliberately not the same as zooming. Every fetch covers a box
 * larger than the screen (`padBounds`), a move that stays inside that box
 * doesn't fetch at all, and a payload that does arrive is *merged* with the
 * pins already held rather than replacing them. Together those three mean a
 * pan doesn't blank the map: plants leaving the screen stay loaded, plants
 * entering it were loaded before they were needed, and the gap between the two
 * is never drawn empty.
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

  const cacheRef = useRef(new Map<string, { payload: Payload; bounds: MapBounds }>());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request id. Only the newest request may write to state — a cache
  // hit or a newer fetch resolving first must not be overwritten by an older
  // response that is still in flight.
  const requestRef = useRef(0);
  const lastKeyRef = useRef<string>('');
  /**
   * The padded box the pins in state cover, and the tier they were fetched at.
   * A viewport inside this needs no request.
   *
   * Seeded from the server-rendered first paint, which read `boundsAround` —
   * deliberately generous — so the `moveend` that fires during initial layout
   * doesn't immediately refetch what the page already shipped. Only when that
   * paint is the tier we're actually at: at cluster zoom the page still sends
   * pins, and those are not the payload this viewport wants.
   */
  const loadedRef = useRef<{ bounds: MapBounds; tier: 'pins' | 'cluster'; filter: MapFilter } | null>(
    tierForZoom(initialView.zoom) === 'pins'
      ? { bounds: boundsAround(initialView), tier: 'pins', filter: 'all' }
      : null
  );

  /**
   * Folds a payload into what's on screen.
   *
   * `covered` is the box the payload speaks for. Inside it the server's answer
   * is the whole truth and replaces what we held, so a removed or re-badged
   * plant can't linger. Outside it, pins are kept: they're from a view we just
   * panned away from and may pan back to. The incoming ones lead the list —
   * the server returns them nearest the centre first — so if the cap has to
   * bite, it bites the plants furthest from the screen.
   */
  const apply = useCallback((payload: Payload, covered: MapBounds, replace: boolean) => {
    setData((prev) => {
      let plants = prev.plants;
      if (payload.tier === 'pins') {
        const incoming = payload.plants ?? [];
        if (replace) {
          plants = incoming;
        } else {
          const fresh = new Set(incoming.map((p) => p.id));
          const kept = prev.plants.filter(
            (p) => !fresh.has(p.id) && !boundsContain(covered, p)
          );
          plants = incoming.concat(kept).slice(0, PLANT_CAP);
        }
      }
      return {
        tier: payload.tier,
        plants,
        points: payload.tier === 'cluster' ? (payload.points ?? []) : [],
        region: payload.region ?? prev.region,
        truncated: payload.truncated ?? false,
        loading: false,
        // A database that fell over after the first paint has to be able to say
        // so. Without this the route's `dbReady: false` was dropped on the floor
        // and an outage rendered as an empty viewport — which the map then
        // explained with "plant your first plant".
        dbReady: payload.dbReady ?? prev.dbReady,
      };
    });
  }, []);

  const fetchViewport = useCallback(
    async (viewport: MapBounds, zoom: number, force = false) => {
      const tier = tierForZoom(zoom);
      // Ask for more than the screen, so panning has somewhere to go, then snap
      // that to the shared grid: two nearby pans become the same request, which
      // both skips work here and gives the edge cache a URL worth keeping.
      const bounds = snapBounds(padBounds(viewport), zoom);
      const key = `${quantizeBounds(bounds, zoom)}:${tier === 'cluster' ? 'cluster' : filter}`;
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
        loadedRef.current = { bounds: cached.bounds, tier, filter };
        apply(cached.payload, cached.bounds, force);
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
        cacheRef.current.set(key, { payload, bounds });
        loadedRef.current = { bounds, tier, filter };
        apply(payload, bounds, force);
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

  /** Call from the map's `onMoveEnd`. Debounced, margin-aware and cached. */
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

    // Still inside what we loaded, at the same tier and filter? Then every pin
    // for this view is already in memory. This is the common case while panning
    // and it costs nothing — no request, no repaint, no flicker.
    const loaded = loadedRef.current;
    if (
      loaded &&
      loaded.tier === tierForZoom(zoom) &&
      loaded.filter === filter &&
      boundsCover(loaded.bounds, bounds)
    ) {
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void fetchViewport(bounds, zoom), DEBOUNCE_MS);
  }, [mapRef, filter, fetchViewport]);

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
  // `force` also makes the payload replace rather than merge: pins held from
  // the previous filter are not answers to this one.
  const filterRef = useRef(filter);
  useEffect(() => {
    if (filterRef.current === filter) return;
    filterRef.current = filter;
    loadedRef.current = null;
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

  // Zoomed out before the cluster payload lands, cluster the pins we already
  // have. Same plants, same coordinates — just drawn as dots.
  const points = useMemo(() => {
    const source = data.tier === 'cluster' ? data.points : data.plants.map(pinToPoint);
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
