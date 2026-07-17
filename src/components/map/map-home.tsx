'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useI18n } from '@/i18n/provider';
import type { PlantSummary, SessionUser } from '@/lib/types';
import { speciesDisplayName } from '@/lib/msg';
import { Avatar } from '@/components/avatar';
import { STATUS_COLOR, statusLabel } from '@/components/pills';
import { IconSearch, IconLocate, IconClose, IconMail } from '@/components/icons';
import { PlantPin, pinStatus } from './plant-marker';
import { PlantSheet } from './plant-sheet';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const FALLBACK_CENTER = { lat: 32.5185, lng: 35.0047 }; // Givat Ada

type FilterKey = 'all' | 'water' | 'harvest' | 'steward' | 'trouble';

function matchesFilter(plant: PlantSummary, filter: FilterKey): boolean {
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

export function MapHome({
  plants,
  user,
  adoptedIds,
  dbReady,
}: {
  plants: PlantSummary[];
  user: SessionUser | null;
  adoptedIds: number[];
  dbReady: boolean;
}) {
  const { dict, locale } = useI18n();
  const mapRef = useRef<MapRef>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  const center = useMemo(() => {
    if (plants.length === 0) return FALLBACK_CENTER;
    const lat = plants.reduce((sum, p) => sum + p.lat, 0) / plants.length;
    const lng = plants.reduce((sum, p) => sum + p.lng, 0) / plants.length;
    return { lat, lng };
  }, [plants]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plants.filter((plant) => {
      if (!matchesFilter(plant, filter)) return false;
      if (!q) return true;
      return (
        plant.name.toLowerCase().includes(q) ||
        plant.speciesName.toLowerCase().includes(q) ||
        (plant.speciesNameHe ?? '').includes(query.trim()) ||
        plant.plantedByName.toLowerCase().includes(q)
      );
    });
  }, [plants, filter, query]);

  const selected = visible.find((p) => p.id === selectedId) ?? null;

  const counts = useMemo(
    () => ({
      all: plants.length,
      water: plants.filter((p) => p.status === 'needs_water').length,
      harvest: plants.filter((p) => p.status === 'ready_to_harvest').length,
      steward: plants.filter((p) => p.upForAdoption).length,
      trouble: plants.filter((p) => p.status === 'needs_attention' || p.status === 'diseased').length,
    }),
    [plants]
  );

  const chips: { key: FilterKey; label: string; dot?: string }[] = [
    { key: 'all', label: `${dict.map.all} · ${counts.all}` },
    { key: 'water', label: dict.map.needsWater, dot: STATUS_COLOR.needs_water },
    { key: 'harvest', label: dict.map.harvest, dot: STATUS_COLOR.ready_to_harvest },
    { key: 'steward', label: dict.map.steward, dot: STATUS_COLOR.steward },
    { key: 'trouble', label: dict.map.trouble, dot: STATUS_COLOR.needs_attention },
  ];

  function locateMe() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 16, duration: 1200 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Map
        ref={mapRef}
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: 15.2 }}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        onClick={() => setSelectedId(null)}
      >
        {myLocation && (
          <Marker latitude={myLocation.lat} longitude={myLocation.lng}>
            <span className="relative flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-water opacity-60" />
              <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-water" />
            </span>
          </Marker>
        )}
        {visible.map((plant) => (
          <Marker
            key={plant.id}
            latitude={plant.lat}
            longitude={plant.lng}
            anchor="center"
            style={{ zIndex: plant.id === selectedId ? 30 : undefined }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedId(plant.id);
              mapRef.current?.flyTo({ center: [plant.lng, plant.lat], offset: [0, -140], duration: 700 });
            }}
          >
            <PlantPin
              plant={plant}
              selected={plant.id === selectedId}
              label={plant.name}
              statusText={statusLabel(pinStatus(plant) as never, dict)}
            />
          </Marker>
        ))}
      </Map>

      {/* Top chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)]">
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

        <div className="hide-scrollbar pointer-events-auto -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
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
        </div>

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
                  mapRef.current?.flyTo({ center: [plant.lng, plant.lat], zoom: 16.5, offset: [0, -140], duration: 800 });
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-chip"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[pinStatus(plant)] }} />
                <span className="flex flex-col">
                  <span className="text-[13.5px] font-semibold text-ink">{plant.name}</span>
                  <span className="text-[11px] text-muted-foreground">{speciesDisplayName(plant, locale)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

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

      {/* Locate me */}
      <button
        type="button"
        onClick={locateMe}
        aria-label={dict.map.locateMe}
        className="absolute bottom-[132px] end-4 z-10 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white text-forest shadow-[0_6px_18px_rgba(32,37,28,0.18)] transition active:scale-95"
      >
        <IconLocate size={21} className="rtl:-scale-x-100" />
      </button>

      {selected && (
        <PlantSheet
          plant={selected}
          user={user}
          adopted={adoptedIds.includes(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
