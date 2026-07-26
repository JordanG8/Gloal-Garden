'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import {
  boundsToParam,
  quantizeBounds,
  PIN_ZOOM,
  VIEW_COOKIE,
  type MapBounds,
  type MapPoint,
  type MapView,
} from '@/lib/map-bounds';
import type { MapCounts, MapFilter } from '@/lib/data';
import type { PlantSummary } from '@/lib/types';

/** Long enough that a flick-pan doesn't fire three requests, short enough to feel live. */
const DEBOUNCE_MS = 250;
/** Quantized viewports we've already fetched. Panning back is free. */
const CACHE_LIMIT = 40;

export interface ViewportState {
  tier: 'pins' | 'cluster';
  plants: PlantSummary[];
  points: MapPoint[];
  counts: MapCounts;
  truncated: boolean;
  loading: boolean;
}

interface Payload {
  tier: 'pins' | 'cluster';
  plants?: PlantSummary[];
  points?: MapPoint[];
  counts?: MapCounts;
  truncated?: boolean;
}

function readBounds(map: MapRef): MapBounds | null {
  try {
    const b = map.getBounds();
    if (!b) return null;
    return {
      minLng: b.getWest(),
      minLat: b.getSouth(),
      maxLng: b.getEast(),
      maxLat: b.getNorth(),
    };
  } catch {
    return null;
  }
}

/**
 * Keeps the map's data in step with what's actually on screen.
 *
 * The map used to receive every plant in the database as a prop and filter in
 * the browser. This fetches only the current viewport, switching between full
 * plant summaries (close in, where photo pins are legible) and a slim point
 * format (zoomed out, where MapLibre clusters them into dots).
 */
export function useMapViewport({
  mapRef,
  filter,
  initial,
  initialView,
}: {
  mapRef: React.RefObject<MapRef | null>;
  filter: MapFilter;
  initial: Pick<ViewportState, 'plants' | 'counts' | 'truncated'>;
  initialView: MapView;
}) {
  const [state, setState] = useState<ViewportState>({
    tier: 'pins',
    plants: initial.plants,
    points: [],
    counts: initial.counts,
    truncated: initial.truncated,
    loading: false,
  });

  const cacheRef = useRef(new Map<string, Payload>());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setState((prev) => ({
      tier: payload.tier,
      plants: payload.tier === 'pins' ? (payload.plants ?? []) : prev.plants,
      points: payload.tier === 'cluster' ? (payload.points ?? []) : [],
      counts: payload.counts ?? prev.counts,
      truncated: payload.truncated ?? false,
      loading: false,
    }));
  }, []);

  const fetchViewport = useCallback(
    async (bounds: MapBounds, zoom: number, force = false) => {
      const key = `${quantizeBounds(bounds, zoom)}:${zoom < PIN_ZOOM ? 'cluster' : filter}`;
      if (!force && key === lastKeyRef.current) return;
      lastKeyRef.current = key;

      const cached = cacheRef.current.get(key);
      if (cached) {
        apply(cached);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState((prev) => ({ ...prev, loading: true }));

      try {
        const params = new URLSearchParams({
          bbox: boundsToParam(bounds),
          zoom: String(zoom),
          filter,
        });
        const res = await fetch(`/api/map?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`map fetch failed: ${res.status}`);
        const payload: Payload = await res.json();

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
        setState((prev) => ({ ...prev, loading: false }));
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

  return { ...state, onViewportChange };
}
