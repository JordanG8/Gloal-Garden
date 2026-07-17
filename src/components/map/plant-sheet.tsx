'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { fill } from '@/i18n';
import type { ObservationEntry, PlantSummary, SessionUser } from '@/lib/types';
import { adoptPlant } from '@/lib/adoption-actions';
import { actionMsg, speciesDisplayName } from '@/lib/msg';
import { daysBetween, shortDate, timeAgo } from '@/lib/format';
import { POINTS, COMMUNITY_MULTIPLIER, WATER_DUE_FRACTION, DEFAULT_WATERING_FREQUENCY_DAYS } from '@/lib/karma';
import { StatusPill } from '@/components/pills';
import { PlantImage } from '@/components/plant-art';
import { ViewT } from '@/components/vt';
import {
  IconDropFilled,
  IconCamera,
  IconBasket,
  IconAlert,
  IconForward,
} from '@/components/icons';
import { pinStatus } from './plant-marker';
import { statusLabel } from '@/components/pills';

function wateringDue(plant: PlantSummary): boolean {
  const freq = plant.wateringFrequencyDays ?? DEFAULT_WATERING_FREQUENCY_DAYS;
  const last = plant.lastWateredAt ?? plant.plantedAt;
  return daysBetween(last) >= WATER_DUE_FRACTION * freq;
}

/** Bottom sheet quick view (design 2.2) for the selected map pin. */
export function PlantSheet({
  plant,
  user,
  adopted,
  onClose,
}: {
  plant: PlantSummary;
  user: SessionUser | null;
  adopted: boolean;
  onClose: () => void;
}) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [timeline, setTimeline] = useState<ObservationEntry[] | null>(null);
  const [adoptPending, startAdopt] = useTransition();
  const [adoptNote, setAdoptNote] = useState('');
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  const base = `/${locale}`;
  const plantHref = `${base}/plants/${plant.id}`;

  useEffect(() => {
    let alive = true;
    setTimeline(null);
    fetch(`/api/plants/${plant.id}/activity`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.observations) setTimeline(data.observations);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [plant.id]);

  const photos = (timeline ?? []).filter((o) => o.photoUrl);
  const shownPhotos = photos.slice(0, 4);
  const extraPhotos = Math.max(0, photos.length - shownPhotos.length);

  const due = wateringDue(plant);
  const isNeighbor = user ? plant.founderId !== user.id : false;
  const verified = plant.photoCount > 0;
  const waterBase = verified ? POINTS.waterDue : POINTS.waterDueUnverified;
  const waterPoints = isNeighbor ? Math.round(waterBase * COMMUNITY_MULTIPLIER) : waterBase;

  const ageDays = daysBetween(plant.plantedAt);
  const canAdopt = user && plant.founderId !== user.id && !adopted;

  const actions = [
    { key: 'water', label: dict.sheet.water, icon: IconDropFilled, solid: true },
    { key: 'photo', label: dict.sheet.photo, icon: IconCamera, solid: false },
    { key: 'harvest', label: dict.sheet.harvest, icon: IconBasket, solid: false, tint: 'text-gold-deep' },
    { key: 'report', label: dict.sheet.report, icon: IconAlert, solid: false, tint: 'text-rust' },
  ] as const;

  return (
    <>
      <button
        aria-label={dict.common.close}
        className="animate-fade absolute inset-0 z-20 bg-ink/20"
        onClick={onClose}
      />
      <div
        className="animate-sheet-up absolute inset-x-0 bottom-0 z-30 flex max-h-[86%] flex-col rounded-t-[28px] bg-cream shadow-[0_-12px_40px_rgba(32,37,28,0.25)]"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined, transition: dragStart.current === null ? undefined : 'none' }}
        onPointerDown={(e) => {
          dragStart.current = e.clientY;
        }}
        onPointerMove={(e) => {
          if (dragStart.current !== null) {
            const dy = e.clientY - dragStart.current;
            if (dy > 0) setDragY(dy);
          }
        }}
        onPointerUp={() => {
          if (dragY > 90) onClose();
          dragStart.current = null;
          setDragY(0);
        }}
      >
        <div className="flex justify-center pb-1.5 pt-3">
          <div className="h-[5px] w-10 rounded-full bg-[#D8D2C2]" />
        </div>

        <div className="hide-scrollbar flex-1 overflow-y-auto px-6 pb-[110px]">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href={plantHref} className="block">
                <h2 className="font-display text-[30px] font-bold uppercase leading-[1.02] text-ink">
                  {plant.name}
                </h2>
              </Link>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {speciesDisplayName(plant, locale)} · <em>{plant.scientificName}</em> ·{' '}
                {fill(dict.sheet.plantedBy, { name: plant.plantedByName })}
              </p>
            </div>
            <StatusPill status={pinStatus(plant) as never} dict={dict} className="mt-1 shrink-0" />
          </div>

          {/* Photo + facts */}
          <div className="mt-4 flex items-stretch gap-3.5">
            <Link href={plantHref} className="shrink-0">
              <ViewT name={`plant-hero-${plant.id}`}>
                <PlantImage
                  photoUrl={plant.latestPhotoUrl}
                  category={plant.category}
                  emoji={plant.emoji}
                  alt={plant.name}
                  className="h-[118px] w-[118px] rounded-2xl"
                  emojiSize={40}
                />
              </ViewT>
            </Link>
            <div className="flex flex-1 flex-col justify-between py-0.5">
              <div className="flex flex-col gap-1.5 text-[12.5px] text-ink">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{dict.sheet.age}</span>
                  <strong>
                    {ageDays} {dict.sheet.days}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{dict.sheet.lastWatered}</span>
                  <strong className={due ? 'text-water' : ''}>
                    {plant.lastWateredAt ? timeAgo(plant.lastWateredAt, locale) : dict.sheet.never}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{dict.sheet.stewards}</span>
                  <strong>{plant.stewardCount > 0 ? plant.stewardCount : dict.sheet.noStewards}</strong>
                </div>
              </div>
              {verified && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gold-deep">
                  <IconCamera size={13} />
                  {plant.photoCount} {dict.sheet.photos} · {dict.sheet.photoVerified}
                </div>
              )}
            </div>
          </div>

          {/* Growth timeline */}
          {photos.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="microlabel text-bark">{dict.sheet.growthTimeline}</span>
                <Link href={plantHref} className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  {dict.sheet.seeAll} <IconForward size={10} />
                </Link>
              </div>
              <div className="relative flex items-start gap-2.5">
                <div className="absolute inset-x-2 top-[26px] h-0.5 bg-line" />
                {shownPhotos
                  .slice()
                  .reverse()
                  .map((photo, i, arr) => (
                    <div key={photo.id} className="relative flex flex-1 flex-col items-center gap-1">
                      <div
                        className={`h-[52px] w-[52px] overflow-hidden rounded-xl shadow-[0_1px_4px_rgba(32,37,28,0.15)] ${
                          i === arr.length - 1 ? 'border-[2.5px] border-gold' : 'border-2 border-cream'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.photoUrl!} alt="" className="h-full w-full object-cover" />
                      </div>
                      <span className={`text-[9.5px] font-semibold ${i === arr.length - 1 ? 'text-gold-deep' : 'text-faint'}`}>
                        {shortDate(photo.createdAt, locale)}
                      </span>
                    </div>
                  ))}
                {extraPhotos > 0 && (
                  <div className="relative flex flex-col items-center gap-1">
                    <div className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[#EFEAD9] text-[11px] font-bold text-muted-foreground">
                      +{extraPhotos}
                    </div>
                    <span className="text-[9.5px] font-semibold text-faint">{dict.sheet.more}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex gap-2.5">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.key}
                  href={`${plantHref}/care?action=${action.key}`}
                  className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl py-3.5 transition active:scale-95 ${
                    action.solid
                      ? 'bg-forest text-cream'
                      : `border border-line bg-card ${'tint' in action && action.tint ? action.tint : 'text-forest'}`
                  }`}
                >
                  <Icon size={21} />
                  <span className={`text-[11px] font-bold ${action.solid ? 'text-cream' : 'text-ink'}`}>
                    {action.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Karma prompt */}
          {due && (
            <Link
              href={`${plantHref}/care?action=water`}
              className="mt-3.5 flex items-center justify-between gap-2 rounded-2xl border border-gold-line bg-gold-tint px-[18px] py-3.5 transition active:scale-[0.99]"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-bold text-gold-ink">
                  {fill(dict.sheet.waterNowKarma, { points: waterPoints })}
                </span>
                <span className="text-[11.5px] text-[#8A7530]">
                  {isNeighbor ? dict.sheet.dueNeighbor : dict.sheet.dueOwn}
                </span>
              </span>
              <IconForward size={16} className="shrink-0 text-gold-deep" />
            </Link>
          )}

          {/* Adopt / history */}
          <div className="mt-4 flex items-center justify-between px-1">
            {canAdopt ? (
              <button
                type="button"
                disabled={adoptPending}
                onClick={() =>
                  startAdopt(async () => {
                    const result = await adoptPlant(plant.id);
                    if (result.ok) {
                      setAdoptNote(fill(dict.plant.adoptedToast, { points: result.pointsAwarded ?? 0 }));
                      router.refresh();
                    } else {
                      setAdoptNote(actionMsg(result.error, dict) ?? dict.common.error);
                    }
                  })
                }
                className="text-[13.5px] font-bold text-forest disabled:opacity-60"
              >
                {dict.sheet.adoptPlant}
              </button>
            ) : (
              <span />
            )}
            <Link href={plantHref} className="flex items-center gap-1 text-[13.5px] font-semibold text-muted-foreground">
              {dict.sheet.fullHistory} <IconForward size={12} />
            </Link>
          </div>
          {adoptNote && (
            <p className="animate-pop mt-2 rounded-xl bg-moss px-3.5 py-2.5 text-[12.5px] font-medium text-forest">
              {adoptNote}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
