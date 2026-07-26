'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useI18n } from '@/i18n/provider';
import { createGarden } from '@/lib/garden-actions';
import { actionMsg } from '@/lib/msg';
import {
  GARDEN_KINDS,
  MAX_GARDEN_NAME,
  MAX_GARDEN_DESCRIPTION,
  MAX_GARDEN_RADIUS_M,
  MIN_GARDEN_RADIUS_M,
  type GardenKind,
} from '@/lib/garden-kinds';
import { MAP_STYLE } from '@/lib/map-bounds';
import { IconBack, IconLocate } from '@/components/icons';

/** Sensible default extent per scale, in metres. */
const DEFAULT_RADIUS: Record<GardenKind, number> = {
  patch: 10,
  plot: 30,
  community: 120,
};

export function CreateGardenFlow({ center }: { center: { lat: number; lng: number } }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<GardenKind>('patch');
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS.patch);
  const [spot, setSpot] = useState(center);
  const [error, setError] = useState('');

  function pickKind(next: GardenKind) {
    setKind(next);
    setRadiusM(DEFAULT_RADIUS[next]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Set state directly as well as flying: onMoveEnd can be missed if the
        // map is already at the destination. Same reasoning as add-plant-flow.
        setSpot(next);
        mapRef.current?.flyTo({ center: [next.lng, next.lat], zoom: 17, duration: 900 });
      },
      () => setError(dict.map.locationError),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function submit() {
    if (!name.trim()) {
      setError(actionMsg('error_garden_name', dict) ?? '');
      return;
    }
    setError('');
    startTransition(async () => {
      const res = await createGarden({
        name,
        kind,
        description,
        lat: spot.lat,
        lng: spot.lng,
        radiusM,
      });
      if (res.ok && res.slug) {
        router.push(`/${locale}/gardens/${res.slug}`);
        router.refresh();
      } else if (!res.ok) {
        setError(actionMsg(res.error, dict) ?? dict.common.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={dict.common.back}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          <IconBack size={16} />
        </button>
        <h1 className="font-display text-[24px] font-bold uppercase text-ink">
          {dict.gardens.createTitle}
        </h1>
        <span className="w-9" />
      </div>

      <div className="relative h-[180px] overflow-hidden rounded-[18px] border border-line">
        <Map
          ref={mapRef}
          initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: 16 }}
          mapStyle={MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
          onMoveEnd={(e) => setSpot({ lat: e.viewState.latitude, lng: e.viewState.longitude })}
        >
          <Marker latitude={spot.lat} longitude={spot.lng} anchor="center">
            {/* The garden's extent, drawn at the map's own scale so the radius
                slider means something visually. */}
            <span
              aria-hidden
              className="block rounded-full border-2 border-forest bg-forest/20"
              style={{ width: 64, height: 64 }}
            />
          </Marker>
        </Map>
        <button
          type="button"
          onClick={useMyLocation}
          aria-label={dict.map.locateMe}
          className="absolute end-2.5 bottom-2.5 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-[11.5px] font-semibold text-ink shadow-[0_2px_8px_rgba(32,37,28,0.15)]"
        >
          <IconLocate size={13} />
          {dict.map.locateMe}
        </button>
      </div>

      <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
        <span className="microlabel text-bark">{dict.gardens.name}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_GARDEN_NAME}
          placeholder={dict.gardens.namePlaceholder}
          className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="microlabel mb-1 text-bark">{dict.gardens.kind}</legend>
        <div className="flex gap-2">
          {GARDEN_KINDS.map((option) => {
            const active = kind === option;
            const label =
              option === 'community'
                ? dict.gardens.kindCommunity
                : option === 'plot'
                  ? dict.gardens.kindPlot
                  : dict.gardens.kindPatch;
            const hint =
              option === 'community'
                ? dict.gardens.kindCommunityHint
                : option === 'plot'
                  ? dict.gardens.kindPlotHint
                  : dict.gardens.kindPatchHint;
            return (
              <button
                key={option}
                type="button"
                onClick={() => pickKind(option)}
                aria-pressed={active}
                className={`flex flex-1 flex-col gap-0.5 rounded-2xl border px-3 py-2.5 text-start transition ${
                  active ? 'border-forest bg-moss' : 'border-line bg-card hover:border-bark'
                }`}
              >
                <span className="text-[13px] font-bold text-ink">{label}</span>
                <span className="text-[10.5px] leading-tight text-muted-foreground">{hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card px-[18px] py-3.5">
        <span className="microlabel text-bark">
          {dict.gardens.radius} · {radiusM} m
        </span>
        <input
          type="range"
          min={MIN_GARDEN_RADIUS_M}
          max={MAX_GARDEN_RADIUS_M}
          step={5}
          value={radiusM}
          onChange={(e) => setRadiusM(Number(e.target.value))}
          className="w-full accent-forest"
        />
      </label>

      <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
        <span className="microlabel text-bark">{dict.gardens.description}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_GARDEN_DESCRIPTION}
          rows={3}
          className="w-full resize-none bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      {error && <p className="text-[12.5px] font-semibold text-rust">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-full bg-forest px-8 py-3.5 text-[15px] font-semibold text-cream transition active:scale-95 disabled:opacity-50"
      >
        {pending ? dict.gardens.saving : dict.gardens.save}
      </button>
    </div>
  );
}
