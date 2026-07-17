'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Map, { type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useI18n } from '@/i18n/provider';
import { fill } from '@/i18n';
import type { SessionUser, SpeciesOption } from '@/lib/types';
import { createPlant } from '@/lib/plant-actions';
import { actionMsg } from '@/lib/msg';
import { POINTS } from '@/lib/karma';
import PhotoInput from '@/components/photo-input';
import { KarmaMoment } from '@/components/karma-moment';
import { IconClose, IconChevronDown, IconStar, IconSearch, IconLocate } from '@/components/icons';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// Client-only sentinel for the "Other — name it yourself" option in the
// species picker; never sent to the server as a real species id.
const CUSTOM_SPECIES_ID = -1;

function speciesName(s: SpeciesOption, locale: string): string {
  return locale === 'he' && s.commonNameHe ? s.commonNameHe : s.commonName;
}

export function AddPlantFlow({
  speciesList,
  user,
  center,
}: {
  speciesList: SpeciesOption[];
  user: SessionUser;
  center: { lat: number; lng: number };
}) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const [speciesOpen, setSpeciesOpen] = useState(false);
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [chosen, setChosen] = useState<SpeciesOption | null>(null);
  const [customSpeciesName, setCustomSpeciesName] = useState('');
  const [nickname, setNickname] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [spot, setSpot] = useState(center);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [doneResult, setDoneResult] = useState<Awaited<ReturnType<typeof createPlant>> | null>(null);

  const filteredSpecies = useMemo(() => {
    const q = speciesQuery.trim().toLowerCase();
    if (!q) return speciesList;
    return speciesList.filter(
      (s) =>
        s.commonName.toLowerCase().includes(q) || (s.commonNameHe ?? '').includes(speciesQuery.trim())
    );
  }, [speciesList, speciesQuery]);

  const isCustomSpecies = chosen?.id === CUSTOM_SPECIES_ID;

  function submit() {
    if (!chosen) {
      setSpeciesOpen(true);
      return;
    }
    if (isCustomSpecies && !customSpeciesName.trim()) {
      setError(dict.add.customNameRequired);
      return;
    }
    setError('');
    startTransition(async () => {
      const res = await createPlant({
        speciesId: isCustomSpecies ? 0 : chosen.id,
        customSpeciesName: isCustomSpecies ? customSpeciesName : undefined,
        lat: spot.lat,
        lng: spot.lng,
        nickname,
        description: '',
        accessNotes,
        photoUrl: photoUrl || undefined,
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
        plantName={nickname || (isCustomSpecies ? customSpeciesName : chosen ? speciesName(chosen, locale) : '')}
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
          aria-label={dict.add.useMyLocation}
          className="absolute end-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-forest shadow-[0_2px_10px_rgba(32,37,28,0.18)] disabled:opacity-60"
        >
          {locating ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest border-t-transparent" />
          ) : (
            <IconLocate size={16} className="rtl:-scale-x-100" />
          )}
        </button>
        <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11.5px] font-semibold text-muted-foreground">
          {dict.add.dragMap}
        </div>
      </div>

      {/* Fields */}
      <div className="mt-4 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setSpeciesOpen(true)}
          className="flex items-center justify-between rounded-2xl border border-line bg-card px-[18px] py-3.5 text-start transition hover:border-forest"
        >
          <span className="flex flex-col gap-0.5">
            <span className="microlabel text-bark">{dict.add.species}</span>
            <span className={`text-[15px] font-semibold ${chosen ? 'text-ink' : 'text-faint'}`}>
              {isCustomSpecies
                ? `${chosen!.emoji} ${dict.add.otherSpecies}`
                : chosen
                  ? `${chosen.emoji} ${speciesName(chosen, locale)} · ${
                      dict.add.categories[chosen.category as keyof typeof dict.add.categories] ?? chosen.category
                    }`
                  : dict.add.chooseSpecies}
            </span>
          </span>
          <IconChevronDown size={14} className="text-muted-foreground" />
        </button>

        {isCustomSpecies && (
          <label className="animate-pop flex flex-col gap-0.5 rounded-2xl border border-forest bg-card px-[18px] py-3.5 transition-all focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
            <span className="microlabel text-bark">{dict.add.customName}</span>
            <input
              autoFocus
              value={customSpeciesName}
              onChange={(e) => setCustomSpeciesName(e.target.value)}
              placeholder={dict.add.customNamePlaceholder}
              maxLength={80}
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

        <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
          <span className="microlabel text-bark">{dict.add.accessNotes}</span>
          <input
            value={accessNotes}
            onChange={(e) => setAccessNotes(e.target.value)}
            placeholder={dict.add.accessPlaceholder}
            maxLength={300}
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

      {/* Species picker sheet */}
      {speciesOpen && (
        <>
          <button
            aria-label={dict.common.close}
            className="animate-fade fixed inset-0 z-40 bg-ink/25"
            onClick={() => setSpeciesOpen(false)}
          />
          <div className="animate-sheet-up fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[70dvh] w-full max-w-[520px] flex-col rounded-t-[28px] bg-cream shadow-[0_-12px_40px_rgba(32,37,28,0.25)]">
            <div className="flex justify-center pb-1.5 pt-3">
              <div className="h-[5px] w-10 rounded-full bg-[#D8D2C2]" />
            </div>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2.5 rounded-full border border-line bg-card px-4 py-2.5">
                <IconSearch size={15} className="text-muted-foreground" />
                <input
                  autoFocus
                  value={speciesQuery}
                  onChange={(e) => setSpeciesQuery(e.target.value)}
                  placeholder={dict.add.searchSpecies}
                  className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
                />
              </div>
            </div>
            <div className="hide-scrollbar flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),20px)]">
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setChosen({ id: CUSTOM_SPECIES_ID, commonName: '', commonNameHe: null, category: 'other', emoji: '✏️' });
                    setSpeciesOpen(false);
                  }}
                  className={`flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-start transition ${
                    isCustomSpecies ? 'border-forest bg-moss' : 'border-[#C9BFA8] bg-card hover:bg-chip'
                  }`}
                >
                  <span className="text-[22px]">✏️</span>
                  <span className="flex flex-col">
                    <span className="text-[14.5px] font-semibold text-ink">{dict.add.otherSpecies}</span>
                  </span>
                </button>
                {filteredSpecies.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setChosen(s);
                      setSpeciesOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-start transition ${
                      chosen?.id === s.id ? 'border-forest bg-moss' : 'border-line bg-card hover:bg-chip'
                    }`}
                  >
                    <span className="text-[22px]">{s.emoji}</span>
                    <span className="flex flex-col">
                      <span className="text-[14.5px] font-semibold text-ink">{speciesName(s, locale)}</span>
                      <span className="text-[11px] uppercase tracking-[0.08em] text-bark">
                        {dict.add.categories[s.category as keyof typeof dict.add.categories] ?? s.category}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
