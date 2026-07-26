'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Map, { type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useI18n } from '@/i18n/provider';
import { fill } from '@/i18n';
import type { SessionUser } from '@/lib/types';
import { createPlant } from '@/lib/plant-actions';
import { actionMsg } from '@/lib/msg';
import { POINTS } from '@/lib/karma';
import PhotoInput from '@/components/photo-input';
import { SpeciesPicker } from './species-picker';
import type { SpeciesOption } from '@/lib/species-data';
import { KarmaMoment } from '@/components/karma-moment';
import { IconClose, IconStar, IconLocate } from '@/components/icons';
import { ensureRtlTextPlugin } from '@/components/map/rtl-text';

// Register Hebrew/Arabic label shaping once, before any map mounts.
ensureRtlTextPlugin();

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export function AddPlantFlow({
  user,
  center,
  catalog,
}: {
  user: SessionUser;
  center: { lat: number; lng: number };
  catalog: SpeciesOption[];
}) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const [plantName, setPlantName] = useState('');
  const [speciesId, setSpeciesId] = useState<number | null>(null);
  const [origin, setOrigin] = useState<'planted_by_me' | 'already_there'>('planted_by_me');
  const [plantedYear, setPlantedYear] = useState('');
  const [nickname, setNickname] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [spot, setSpot] = useState(center);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [doneResult, setDoneResult] = useState<Awaited<ReturnType<typeof createPlant>> | null>(null);

  function submit() {
    if (!plantName.trim()) {
      setError(dict.add.plantNameRequired);
      return;
    }
    setError('');
    startTransition(async () => {
      // A year on its own is a January date with 'year' precision — honest
      // about how well it's actually known. An implausible year is dropped
      // rather than rejected; the pin matters more than the date.
      const year = Number(plantedYear);
      const knownYear =
        origin === 'already_there' &&
        plantedYear.length === 4 &&
        year >= 1900 &&
        year <= new Date().getFullYear();

      const res = await createPlant({
        plantName,
        lat: spot.lat,
        lng: spot.lng,
        nickname,
        description: '',
        photoUrl: photoUrl || undefined,
        speciesId: speciesId ?? undefined,
        origin,
        plantedAt: knownYear ? new Date(Date.UTC(year, 0, 1)).toISOString() : undefined,
        plantedAtPrecision: knownYear ? 'year' : origin === 'already_there' ? 'unknown' : 'day',
      });
      if (res.ok) {
        setDoneResult(res);
      } else {
        setError(actionMsg(res.error, dict) ?? dict.common.error);
      }
    });
  }

  if (doneResult?.ok) {
    return (
      <KarmaMoment
        points={doneResult.pointsAwarded ?? 0}
        note={doneResult.note}
        breakdown={doneResult.breakdown}
        newBadges={doneResult.newBadges ?? []}
        userName={user.name}
        plantName={nickname || plantName}
        onDone={() => router.push(`/${locale}`)}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),56px)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={dict.common.close}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-line bg-card text-ink transition hover:bg-chip"
        >
          <IconClose size={16} />
        </button>
        <h1 className="font-display text-[24px] font-bold uppercase tracking-[0.04em] text-ink">
          {dict.add.title}
        </h1>
        <div className="w-[38px]" />
      </div>

      {/* Spot picker: drag the map under a fixed pin */}
      <div className="relative h-[180px] shrink-0 overflow-hidden rounded-[18px] border border-line">
        <Map
          ref={mapRef}
          initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: 16 }}
          mapStyle={MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
          onMoveEnd={(e) => setSpot({ lat: e.viewState.latitude, lng: e.viewState.longitude })}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <svg width="34" height="42" viewBox="0 0 24 30" fill="none">
            <path
              d="M12 29C12 29 3 18.5 3 11C3 6 7 2 12 2C17 2 21 6 21 11C21 18.5 12 29 12 29Z"
              fill="#17402B"
            />
            <circle cx="12" cy="11" r="4" fill="#C9A22B" />
          </svg>
        </div>
        <button
          type="button"
          disabled={locating}
          onClick={() => {
            if (!navigator.geolocation) {
              setError(dict.add.locationError);
              return;
            }
            setLocating(true);
            setError('');
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                // Set the pin directly from the GPS fix — don't depend on the
                // map's onMoveEnd firing after flyTo.
                setSpot(loc);
                mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 17, duration: 900 });
                setLocating(false);
              },
              () => {
                setError(dict.add.locationError);
                setLocating(false);
              },
              { enableHighAccuracy: true, timeout: 8000 }
            );
          }}
          className="absolute end-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-white py-2 ps-2.5 pe-3.5 text-forest shadow-[0_2px_10px_rgba(32,37,28,0.18)] disabled:opacity-60"
        >
          {locating ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest border-t-transparent" />
          ) : (
            <IconLocate size={16} />
          )}
          <span className="text-[12px] font-semibold whitespace-nowrap">{dict.add.useMyLocation}</span>
        </button>
        <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11.5px] font-semibold text-muted-foreground">
          {dict.add.dragMap}
        </div>
      </div>

      {/* Fields */}
      <div className="mt-4 flex flex-col gap-2.5">
        {/*
          Origin comes first because it changes what the rest of the form
          means. Most of what gets mapped here will be someone else's citrus
          leaning over a wall — not something the mapper planted, and not
          theirs to water.
        */}
        <fieldset className="flex flex-col gap-2">
          <legend className="microlabel mb-1 text-bark">{dict.add.originQuestion}</legend>
          <div className="flex gap-2">
            {(['planted_by_me', 'already_there'] as const).map((option) => {
              const active = origin === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setOrigin(option)}
                  aria-pressed={active}
                  className={`flex flex-1 flex-col gap-0.5 rounded-2xl border px-3 py-2.5 text-start transition ${
                    active ? 'border-forest bg-moss' : 'border-line bg-card hover:border-bark'
                  }`}
                >
                  <span className="text-[13px] font-bold text-ink">
                    {option === 'planted_by_me' ? dict.add.originPlanted : dict.add.originExisting}
                  </span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground">
                    {option === 'planted_by_me'
                      ? dict.add.originPlantedHint
                      : dict.add.originExistingHint}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <SpeciesPicker
          value={{ name: plantName, speciesId }}
          onChange={(next) => {
            setPlantName(next.name);
            setSpeciesId(next.speciesId);
          }}
          catalog={catalog}
        />

        {/* Only asked when it's a real question. If you planted it, it's today. */}
        {origin === 'already_there' && (
          <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
            <span className="microlabel text-bark">{dict.add.plantedYear}</span>
            <input
              value={plantedYear}
              onChange={(e) => setPlantedYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder={dict.add.plantedYearPlaceholder}
              className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
            />
          </label>
        )}

        <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
          <span className="microlabel text-bark">{dict.add.nickname}</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={dict.add.nicknamePlaceholder}
            maxLength={80}
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
          />
        </label>

        <PhotoInput name="photo" label={dict.add.photoLabel} height={104} onChange={setPhotoUrl} />
      </div>

      {error && (
        <p className="animate-pop mt-3 rounded-2xl bg-rust-tint px-4 py-3 text-[13px] font-medium text-rust-ink">
          {error}
        </p>
      )}

      {/* Karma note + CTA */}
      <div className="mt-auto flex flex-col gap-3 pt-5">
        <div className="flex items-center gap-2.5 rounded-[14px] bg-moss px-4 py-3">
          <IconStar size={17} className="shrink-0 text-leaf" />
          <span className="text-[12px] leading-[1.45] text-forest">
            <strong>{fill(dict.add.karmaInfoStrong, { points: POINTS.plantNew })}</strong>{' '}
            {dict.add.karmaInfoRest}
          </span>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="w-full rounded-full bg-forest py-[17px] text-center text-[16px] font-semibold text-cream transition active:scale-[0.985] disabled:opacity-70"
        >
          {pending ? dict.add.planting : dict.add.plantIt}
        </button>
      </div>

    </div>
  );
}
