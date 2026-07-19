/* eslint-disable @next/next/no-img-element */
'use client';

import { STATUS_COLOR } from '@/components/pills';
import {
  IconDropFilled,
  IconBasketFilled,
  IconHeart,
  IconLeafPair,
} from '@/components/icons';
import { pinStatus } from '@/lib/plant-status';
import type { PlantSummary } from '@/lib/types';

export { pinStatus };

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
export function PlantPin({
  plant,
  selected,
  label,
  statusText,
}: {
  plant: PlantSummary;
  selected: boolean;
  label: string;
  statusText: string;
}) {
  const status = pinStatus(plant);
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.growing;
  const size = selected ? 92 : 68;
  const badgeSize = selected ? 34 : 26;
  const hasPhoto = Boolean(plant.latestPhotoUrl);

  return (
    <div className="animate-marker-drop relative flex flex-col items-center" style={{ zIndex: selected ? 30 : 1 }}>
      {selected && (
        <div className="animate-pop pointer-events-none absolute bottom-full mb-2 flex flex-col items-center">
          <div className="flex flex-col gap-px whitespace-nowrap rounded-xl bg-ink px-3.5 py-2 text-cream shadow-[0_8px_20px_rgba(32,37,28,0.3)]">
            <span className="text-[13px] font-bold">{label}</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-gold-bright">
              {statusText}
            </span>
          </div>
          <div className="-mt-px h-2 w-2 rotate-45 bg-ink" />
        </div>
      )}
      <div
        className="relative flex items-center justify-center rounded-full shadow-[0_4px_10px_rgba(32,37,28,0.3)] transition-all duration-200"
        style={{
          width: size,
          height: size,
          background: hasPhoto ? '#fff' : color,
          border: selected ? '4px solid #fff' : '3px solid #fff',
        }}
      >
        {hasPhoto ? (
          <img
            src={plant.latestPhotoUrl!}
            alt=""
            width={size}
            height={size}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <PinIcon status={status} size={selected ? 38 : 28} />
        )}
        {hasPhoto && (
          <div
            className="absolute right-0 bottom-0 flex items-center justify-center rounded-full"
            style={{ width: badgeSize, height: badgeSize, background: color, border: '2px solid #fff' }}
          >
            <PinIcon status={status} size={selected ? 17 : 13} />
          </div>
        )}
      </div>
    </div>
  );
}
