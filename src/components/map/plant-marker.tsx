/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/provider';
import { STATUS_COLOR, statusLabel } from '@/components/pills';
import { PlantImage } from '@/components/plant-art';
import { ViewT } from '@/components/vt';
import { daysBetween, timeAgo } from '@/lib/format';
import { plantSubtitle } from '@/lib/msg';
import {
  IconDropFilled,
  IconBasketFilled,
  IconHeart,
  IconCamera,
  IconForward,
} from '@/components/icons';
import { pinStatus } from '@/lib/plant-status';
import type { PlantSummary } from '@/lib/types';

export { pinStatus };

/** Collapsed pin diameter; the open card is CARD_SCALE× this. */
const PIN_SIZE = 68;
const CARD_SCALE = 2.5;
const CARD_WIDTH = Math.round(PIN_SIZE * CARD_SCALE);

function PinIcon({ status, size }: { status: string; size: number }) {
  const common = { size, className: 'text-white' };
  switch (status) {
    case 'needs_water':
      return <IconDropFilled {...common} />;
    case 'ready_to_harvest':
      return <IconBasketFilled {...common} />;
    case 'needs_attention':
      return <span className="font-sans text-[16px] font-extrabold leading-none text-white">!</span>;
    case 'steward':
      return <IconHeart {...common} />;
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <path d="M10 17C10 11 13 5 18 3C18 10 15 15 10 17Z" fill="#fff" />
          <path d="M10 17C10 12 8 7 2 5C2 11 5 15 10 17Z" fill="#fff" />
        </svg>
      );
  }
}

/**
 * Circular pin: the plant's latest photo when one exists (so the map reads as
 * a photo wall of the garden), falling back to the status-colored icon pin
 * for plants nobody has photographed yet. A small status badge always sits
 * on top so color/state stays scannable even over a photo.
 */
function CollapsedPin({ plant }: { plant: PlantSummary }) {
  const status = pinStatus(plant);
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.growing;
  const hasPhoto = Boolean(plant.latestPhotoUrl);
  const badgeSize = 26;

  return (
    <div
      className="relative flex items-center justify-center rounded-full border-[3px] border-white shadow-[0_4px_10px_rgba(32,37,28,0.3)]"
      style={{ width: PIN_SIZE, height: PIN_SIZE, background: hasPhoto ? '#fff' : color }}
    >
      {hasPhoto ? (
        <img
          src={plant.latestPhotoUrl!}
          alt=""
          width={PIN_SIZE}
          height={PIN_SIZE}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <PinIcon status={status} size={28} />
      )}
      {hasPhoto && (
        <div
          className="absolute bottom-0 end-0 flex items-center justify-center rounded-full border-2 border-white"
          style={{ width: badgeSize, height: badgeSize, background: color }}
        >
          <PinIcon status={status} size={13} />
        </div>
      )}
    </div>
  );
}

/**
 * Open state: the pin itself grows into a rounded card in place — photo,
 * name, the two facts people actually act on, and a button spanning the whole
 * bottom edge through to the full plant page. Deliberately *not* a bottom
 * sheet: the plant stays where it is on the map, so tapping a pin never hides
 * the neighborhood behind a panel.
 */
function OpenCard({ plant, href }: { plant: PlantSummary; href: string }) {
  const { dict, locale } = useI18n();
  const status = pinStatus(plant);
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.growing;
  const ageDays = daysBetween(plant.plantedAt);

  return (
    <div
      className="animate-pop flex flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_16px_38px_rgba(32,37,28,0.34)] ring-[3px] ring-white"
      style={{ width: CARD_WIDTH }}
    >
      <div className="relative">
        <ViewT name={`plant-hero-${plant.id}`}>
          <PlantImage
            photoUrl={plant.latestPhotoUrl}
            category={plant.category}
            emoji={plant.emoji}
            alt={plant.name}
            className="h-[112px] w-full"
            emojiSize={30}
          />
        </ViewT>
        <span
          className="absolute start-2 top-2 inline-flex max-w-[calc(100%-16px)] items-center rounded-full px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_2px_6px_rgba(32,37,28,0.3)]"
          style={{ background: color }}
        >
          <span className="truncate">{statusLabel(status, dict)}</span>
        </span>
        {plant.photoCount > 0 && (
          <span className="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-[3px] text-[9.5px] font-bold text-cream backdrop-blur-sm">
            <IconCamera size={10} />
            {plant.photoCount}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 px-3 pt-2 pb-2.5">
        <span className="line-clamp-2 font-display text-[17px] font-bold uppercase leading-[1.05] text-ink">
          {plant.name}
        </span>
        <span className="truncate text-[10.5px] leading-tight text-muted-foreground">
          {plantSubtitle(plant, locale, dict)}
        </span>
        <div className="mt-0.5 flex flex-col gap-0.5 text-[10px] leading-tight">
          <span className="flex items-baseline justify-between gap-1.5">
            <span className="text-faint">{dict.plantCard.age}</span>
            <strong className="text-ink">
              {ageDays} {dict.plantCard.days}
            </strong>
          </span>
          <span className="flex items-baseline justify-between gap-1.5">
            <span className="shrink-0 text-faint">{dict.plantCard.lastWatered}</span>
            <strong className="truncate text-ink">
              {plant.lastWateredAt ? timeAgo(plant.lastWateredAt, locale) : dict.plantCard.never}
            </strong>
          </span>
        </div>
      </div>

      <Link
        href={href}
        className="flex items-center justify-center gap-1 bg-forest py-3 text-[11.5px] font-bold text-cream transition active:brightness-110"
      >
        {dict.map.fullPlantPage}
        <IconForward size={11} />
      </Link>
    </div>
  );
}

export function PlantPin({
  plant,
  selected,
  href,
}: {
  plant: PlantSummary;
  selected: boolean;
  href: string;
}) {
  return (
    <div
      className="animate-marker-drop relative flex flex-col items-center"
      style={{ zIndex: selected ? 30 : 1 }}
    >
      {selected ? <OpenCard plant={plant} href={href} /> : <CollapsedPin plant={plant} />}
    </div>
  );
}
