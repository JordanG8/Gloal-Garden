'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useI18n } from '@/i18n/provider';
import type { MapCounts, MapFilter } from '@/lib/data';
import { codeToStatus, MAP_STYLE, PIN_ZOOM, type MapView } from '@/lib/map-bounds';
import { useMapViewport } from './use-map-viewport';
import type { PlantSummary, SessionUser } from '@/lib/types';
import { plantSubtitle } from '@/lib/msg';
import { Avatar } from '@/components/avatar';
import { STATUS_COLOR } from '@/components/pills';
import { IconSearch, IconLocate, IconClose, IconMail } from '@/components/icons';
import { PlantPin, pinStatus } from './plant-marker';
import { UserLocationMarker } from './user-location-marker';
import { ensureRtlTextPlugin } from './rtl-text';

// Register Hebrew/Arabic label shaping once, before any map mounts.
ensureRtlTextPlugin();

/** iOS 13+ gates device orientation behind an explicit, gesture-triggered prompt. */
type DeviceOrientationEventConstructorWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/** Compass heading in degrees clockwise from true north, from whichever orientation event the browser fires. */
function headingFromOrientationEvent(e: DeviceOrientationEvent): number | null {
  const withCompass = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if (typeof withCompass.webkitCompassHeading === 'number') return withCompass.webkitCompassHeading;
  if (e.alpha !== null && e.alpha !== undefined) return (360 - e.alpha) % 360;
  return null;
}

// Exponential smoothing factor for the compass (0 = frozen, 1 = raw/jittery).
const HEADING_SMOOTHING = 0.4;

/**
 * Fold a fresh 0–360 compass reading into a *continuous* heading. Instead of
 * clamping back into [0,360) — which makes 359°→1° look like a 358° jump
 * backwards and sends the CSS-rotated cone spinning the long way round — we
 * accumulate the shortest signed step onto the running value, then low-pass it
 * to damp jitter. The result grows/shrinks monotonically as the phone turns,
 * so `rotate()` always animates the short way.
 */
function nextHeading(prev: number | null, prevRaw: number | null, raw: number): number {
  if (prev === null || prevRaw === null) return raw;
  const step = ((raw - prevRaw + 540) % 360) - 180; // shortest turn, −180..180
  return prev + step * HEADING_SMOOTHING;
}

export function MapHome({
  plants: initialPlants,
  user,
  dbReady,
  truncated: initialTruncated,
  counts: initialCounts,
  initialView,
}: {
  plants: PlantSummary[];
  user: SessionUser | null;
  dbReady: boolean;
  truncated: boolean;
  counts: MapCounts;
  initialView: MapView;
}) {
  const { dict, locale } = useI18n();
  const mapRef = useRef<MapRef>(null);
  const [filter, setFilter] = useState<MapFilter>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [tilesError, setTilesError] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const orientationHandlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  // Continuous (unwrapped) heading + the last raw reading it was derived from,
  // plus a latch so we ignore the relative `deviceorientation` stream once an
  // absolute source is available (mixing the two conventions amplifies jitter).
  const headingRef = useRef<number | null>(null);
  const rawHeadingRef = useRef<number | null>(null);
  const absoluteHeadingRef = useRef(false);

  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (orientationHandlerRef.current) {
      window.removeEventListener('deviceorientationabsolute', orientationHandlerRef.current as EventListener);
      window.removeEventListener('deviceorientation', orientationHandlerRef.current as EventListener);
      orientationHandlerRef.current = null;
    }
    headingRef.current = null;
    rawHeadingRef.current = null;
    absoluteHeadingRef.current = false;
    setTracking(false);
    setHeading(null);
  }

  useEffect(() => stopTracking, []);

  async function startTracking() {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const isAbsolute =
        e.type === 'deviceorientationabsolute' ||
        (e as DeviceOrientationEvent & { absolute?: boolean }).absolute === true ||
        typeof (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading ===
          'number';
      // Prefer an absolute (true-north) source; once one arrives, drop the
      // relative stream so the two don't interleave and jitter the cone.
      if (absoluteHeadingRef.current && !isAbsolute) return;
      if (isAbsolute) absoluteHeadingRef.current = true;

      const raw = headingFromOrientationEvent(e);
      if (raw === null) return;
      const continuous = nextHeading(headingRef.current, rawHeadingRef.current, raw);
      headingRef.current = continuous;
      rawHeadingRef.current = raw;
      setHeading(continuous);
    };
    orientationHandlerRef.current = handleOrientation;
    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener);
    window.addEventListener('deviceorientation', handleOrientation as EventListener);

    // Must run from this click's gesture, not after an awaited geolocation call.
    const DOE = (window as unknown as { DeviceOrientationEvent?: DeviceOrientationEventConstructorWithPermission })
      .DeviceOrientationEvent;
    if (typeof DOE?.requestPermission === 'function') {
      try {
        await DOE.requestPermission();
      } catch {
        // Compass stays unavailable; live position tracking still works.
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setLocateError(dict.map.locationError);
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    setTracking(true);
  }

  function locateMe() {
    if (tracking) {
      stopTracking();
      return;
    }
    if (!navigator.geolocation) {
      setLocateError(dict.map.locationError);
      return;
    }
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 16, duration: 1200 });
      },
      () => setLocateError(dict.map.locationError),
      { enableHighAccuracy: true, timeout: 8000 }
    );
    startTracking();
  }

  // Mirror Google Maps: if the visitor has already granted location access,
  // drop their "you are here" dot automatically on load instead of waiting for
  // a tap. First-time visitors are never force-prompted here — they still opt
  // in via the locate button — and a failed silent lookup stays quiet.
  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions?.query || watchIdRef.current !== null) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (cancelled || status.state !== 'granted' || watchIdRef.current !== null) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setMyLocation(loc);
            mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 16, duration: 1200 });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 }
        );
        startTracking();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only what's on screen. Filtering happens server-side against the whole
  // viewport, so the chips no longer describe a page of results.
  const { tier, plants, points, counts, truncated, loading, onViewportChange } = useMapViewport({
    mapRef,
    filter,
    initial: { plants: initialPlants, counts: initialCounts, truncated: initialTruncated },
    initialView,
  });

  // Search narrows what's already loaded — at pin zoom that's the street you're
  // looking at, which is the scope people mean when they search the map.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plants;
    return plants.filter(
      (plant) =>
        plant.name.toLowerCase().includes(q) ||
        plant.speciesName.toLowerCase().includes(q) ||
        (plant.speciesNameHe ?? '').includes(query.trim()) ||
        plant.scientificName.toLowerCase().includes(q) ||
        (plant.customSpeciesName ?? '').toLowerCase().includes(q) ||
        plant.plantedByName.toLowerCase().includes(q)
    );
  }, [plants, query]);

  // MapLibre clusters this itself; we only hand it the points.
  const clusterData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((p) => ({
        type: 'Feature' as const,
        id: p.i,
        geometry: { type: 'Point' as const, coordinates: [p.x, p.y] },
        properties: { id: p.i, status: codeToStatus(p.s), adoptable: p.a },
      })),
    }),
    [points]
  );

  const chips: { key: MapFilter; label: string; dot?: string }[] = [
    { key: 'all', label: `${dict.map.all} · ${counts.all}` },
    { key: 'water', label: dict.map.needsWater, dot: STATUS_COLOR.needs_water },
    { key: 'harvest', label: dict.map.harvest, dot: STATUS_COLOR.ready_to_harvest },
    { key: 'steward', label: dict.map.steward, dot: STATUS_COLOR.steward },
    { key: 'trouble', label: dict.map.trouble, dot: STATUS_COLOR.needs_attention },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Map
        key={mapKey}
        ref={mapRef}
        initialViewState={{
          latitude: initialView.lat,
          longitude: initialView.lng,
          zoom: initialView.zoom,
        }}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        onClick={() => setSelectedId(null)}
        onError={() => setTilesError(true)}
        onLoad={onViewportChange}
        onMoveEnd={onViewportChange}
      >
        {myLocation && (
          <Marker latitude={myLocation.lat} longitude={myLocation.lng}>
            <UserLocationMarker heading={heading} />
          </Marker>
        )}

        {/*
          Zoomed out, plants become clustered dots. These are declarative
          <Source>/<Layer> rather than imperative map.addSource() on purpose:
          the tiles-error retry below remounts the whole <Map> via `key`, which
          would silently discard anything added imperatively.
        */}
        {tier === 'cluster' && (
          <Source
            id="plant-points"
            type="geojson"
            data={clusterData}
            cluster
            clusterRadius={50}
            clusterMaxZoom={Math.floor(PIN_ZOOM)}
          >
            <Layer
              id="plant-clusters"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': '#17402B',
                'circle-opacity': 0.9,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#FAF8F2',
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['get', 'point_count'],
                  2, 16,
                  25, 24,
                  200, 34,
                  1000, 44,
                ],
              }}
            />
            <Layer
              id="plant-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'text-field': ['get', 'point_count_abbreviated'],
                'text-size': 13,
                'text-allow-overlap': true,
              }}
              paint={{ 'text-color': '#FAF8F2' }}
            />
            <Layer
              id="plant-point"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-radius': 7,
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#FAF8F2',
                'circle-color': [
                  'case',
                  ['==', ['get', 'adoptable'], 1], STATUS_COLOR.steward,
                  ['==', ['get', 'status'], 'needs_water'], STATUS_COLOR.needs_water,
                  ['==', ['get', 'status'], 'ready_to_harvest'], STATUS_COLOR.ready_to_harvest,
                  ['==', ['get', 'status'], 'needs_attention'], STATUS_COLOR.needs_attention,
                  ['==', ['get', 'status'], 'diseased'], STATUS_COLOR.needs_attention,
                  STATUS_COLOR.growing,
                ],
              }}
            />
          </Source>
        )}

        {tier === 'pins' && visible.map((plant) => (
          <Marker
            key={plant.id}
            latitude={plant.lat}
            longitude={plant.lng}
            anchor="center"
            style={{ zIndex: plant.id === selectedId ? 30 : undefined }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              // A tap opens the pin in place; the card's own button is the only
              // way to leave the map.
              setSelectedId(plant.id);
              mapRef.current?.flyTo({ center: [plant.lng, plant.lat], duration: 700 });
            }}
          >
            <PlantPin
              plant={plant}
              selected={plant.id === selectedId}
              href={`/${locale}/plants/${plant.id}`}
            />
          </Marker>
        ))}
      </Map>

      {/* Top chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)]">
        {tilesError && (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-rust-ink/15 bg-rust-tint/95 px-4 py-2.5 shadow-[0_4px_16px_rgba(32,37,28,0.08)] backdrop-blur-sm">
            <span className="min-w-0 flex-1 text-[12px] font-semibold text-rust-ink">{dict.map.tilesError}</span>
            <button
              type="button"
              onClick={() => {
                setTilesError(false);
                setMapKey((k) => k + 1);
              }}
              className="shrink-0 rounded-full bg-rust-ink/10 px-3 py-1.5 text-[11.5px] font-bold text-rust-ink"
            >
              {dict.map.retry}
            </button>
          </div>
        )}
        {user && user.verificationRequired && (
          <Link
            href={`/${locale}/verify-email`}
            className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-gold-line bg-gold-tint/95 px-4 py-2.5 shadow-[0_4px_16px_rgba(32,37,28,0.08)] backdrop-blur-sm"
          >
            <IconMail size={16} className="shrink-0 text-gold-deep" />
            <span className="text-[12px] font-semibold text-gold-ink">{dict.auth.verifyBanner}</span>
          </Link>
        )}
        <div className="flex items-center gap-2.5">
          <div className="pointer-events-auto flex flex-1 items-center gap-2.5 rounded-full bg-white/95 px-[18px] py-3 shadow-[0_4px_16px_rgba(32,37,28,0.1)] backdrop-blur-md">
            <IconSearch size={16} className="shrink-0 text-muted-foreground" />
            <input
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.map.search}
              className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                aria-label={dict.common.close}
                onClick={() => {
                  setQuery('');
                  setSearchOpen(false);
                }}
              >
                <IconClose size={14} className="text-muted-foreground" />
              </button>
            )}
          </div>
          {user && (
            <Link href={`/${locale}/me`} className="pointer-events-auto shrink-0 shadow-[0_4px_16px_rgba(32,37,28,0.2)] rounded-full">
              <Avatar name={user.name} id={user.id} src={user.avatar} size={44} />
            </Link>
          )}
        </div>

        <div className="hide-scrollbar pointer-events-auto -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,black_92%,transparent_100%)] rtl:[mask-image:linear-gradient(to_left,black_92%,transparent_100%)]">
          {chips.map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold whitespace-nowrap transition active:scale-95 ${
                  active
                    ? 'bg-ink text-cream shadow-[0_2px_8px_rgba(32,37,28,0.25)]'
                    : 'bg-white/95 text-ink shadow-[0_2px_8px_rgba(32,37,28,0.08)]'
                }`}
              >
                {chip.dot && <span className="h-2 w-2 rounded-full" style={{ background: chip.dot }} />}
                {chip.label}
              </button>
            );
          })}
          {loading && (
            <span
              aria-hidden
              className="skeleton h-8 w-8 shrink-0 self-center rounded-full opacity-60"
            />
          )}
        </div>

        {/*
          The viewport holds more plants than we draw pins for. Saying so beats
          silently dropping them, which is what an uncapped map would do to the
          browser instead.
        */}
        {truncated && !query && (
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 400 })}
            className="pointer-events-auto animate-rise self-start rounded-full bg-ink/90 px-3.5 py-1.5 text-[11.5px] font-semibold text-cream shadow-[0_2px_8px_rgba(32,37,28,0.25)] backdrop-blur-sm"
          >
            {dict.map.zoomForMore}
          </button>
        )}

        {searchOpen && query && (
          <div className="pointer-events-auto animate-rise flex max-h-64 flex-col gap-1 overflow-y-auto rounded-2xl bg-white/97 p-2 shadow-[0_8px_28px_rgba(32,37,28,0.15)] backdrop-blur-md">
            {visible.length === 0 && (
              <p className="px-3 py-2.5 text-[13px] text-muted-foreground">{dict.map.noResults}</p>
            )}
            {visible.slice(0, 8).map((plant) => (
              <button
                key={plant.id}
                type="button"
                onClick={() => {
                  setSelectedId(plant.id);
                  setSearchOpen(false);
                  mapRef.current?.flyTo({ center: [plant.lng, plant.lat], zoom: 16.5, duration: 800 });
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-chip"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[pinStatus(plant)] }} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13.5px] font-semibold text-ink">{plant.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {plantSubtitle(plant, locale, dict)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Data load failed — surface it instead of leaving a silently blank map. */}
      {!dbReady && (
        <div className="absolute inset-x-8 top-1/2 z-10 -translate-y-1/2">
          <div className="animate-pop flex flex-col items-center gap-3 rounded-3xl bg-white/95 p-6 text-center shadow-[0_8px_28px_rgba(32,37,28,0.15)] backdrop-blur-md">
            <span className="text-[40px]">🌍</span>
            <p className="text-[14px] font-semibold text-ink">{dict.map.loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-forest px-6 py-3 text-[14px] font-semibold text-cream transition active:scale-95"
            >
              {dict.map.retry}
            </button>
          </div>
        </div>
      )}

      {/* Empty garden */}
      {dbReady && plants.length === 0 && (
        <div className="absolute inset-x-8 top-1/2 z-10 -translate-y-1/2">
          <div className="animate-pop flex flex-col items-center gap-3 rounded-3xl bg-white/95 p-6 text-center shadow-[0_8px_28px_rgba(32,37,28,0.15)] backdrop-blur-md">
            <span className="text-[40px]">🌱</span>
            <p className="text-[14px] font-semibold text-ink">{dict.map.dbEmpty}</p>
            <Link
              href={`/${locale}/add`}
              className="rounded-full bg-forest px-6 py-3 text-[14px] font-semibold text-cream"
            >
              {dict.garden.plantFirst}
            </Link>
          </div>
        </div>
      )}

      {/* Locate me / live tracking toggle — tap starts a Pokemon-Go-style
          "you are here" marker with a facing cone; tap again stops it. */}
      <button
        type="button"
        onClick={locateMe}
        aria-label={tracking ? dict.map.liveLocationOn : dict.map.locateMe}
        aria-pressed={tracking}
        className={`absolute bottom-[132px] end-4 z-10 flex items-center gap-2 rounded-full py-3 ps-3.5 pe-[18px] shadow-[0_6px_18px_rgba(32,37,28,0.18)] transition active:scale-95 ${
          tracking ? 'bg-water text-white' : 'bg-white text-forest'
        }`}
      >
        <IconLocate size={19} />
        <span className="text-[13px] font-semibold whitespace-nowrap">{dict.map.myLocation}</span>
      </button>

      {locateError && (
        <div className="pointer-events-none absolute inset-x-6 bottom-[196px] z-10 flex justify-center">
          <p className="animate-pop pointer-events-auto rounded-full bg-ink/85 px-4 py-2.5 text-[12.5px] font-medium text-cream backdrop-blur-sm">
            {locateError}
          </p>
        </div>
      )}

    </div>
  );
}
