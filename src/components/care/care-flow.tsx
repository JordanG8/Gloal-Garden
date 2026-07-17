'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { fill } from '@/i18n';
import type { PlantSummary, SessionUser } from '@/lib/types';
import { logCareAction } from '@/lib/plant-actions';
import { actionMsg } from '@/lib/msg';
import {
  POINTS,
  COMMUNITY_MULTIPLIER,
  WATER_DUE_FRACTION,
  DEFAULT_WATERING_FREQUENCY_DAYS,
} from '@/lib/karma';
import { daysBetween, timeAgo } from '@/lib/format';
import PhotoInput from '@/components/photo-input';
import { KarmaMoment } from '@/components/karma-moment';
import { IconClose, IconDropFilled, IconCamera, IconBasket, IconAlert, IconCheck } from '@/components/icons';

type CareType = 'water' | 'photo' | 'harvest' | 'report' | 'resolve';

export function CareFlow({
  plant,
  user,
  initialAction,
}: {
  plant: PlantSummary;
  user: SessionUser;
  initialAction?: string;
}) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const validInitial: CareType =
    initialAction === 'photo' || initialAction === 'harvest' || initialAction === 'report' || initialAction === 'resolve'
      ? initialAction
      : 'water';
  const [type, setType] = useState<CareType>(validInitial);
  const [caption, setCaption] = useState('');
  const [quantity, setQuantity] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<Awaited<ReturnType<typeof logCareAction>> | null>(null);

  const isNeighbor = plant.founderId !== user.id;
  const mult = (n: number) => (isNeighbor ? Math.round(n * COMMUNITY_MULTIPLIER) : n);
  const verified = plant.photoCount > 0;

  const freq = plant.wateringFrequencyDays ?? DEFAULT_WATERING_FREQUENCY_DAYS;
  const lastWatered = plant.lastWateredAt ?? plant.plantedAt;
  const due = daysBetween(lastWatered) >= WATER_DUE_FRACTION * freq;
  const dueAt = new Date(new Date(lastWatered).getTime() + freq * 86_400_000);

  const inTrouble = plant.status === 'needs_attention' || plant.status === 'diseased';

  const tiles: {
    key: CareType;
    icon: React.ReactNode;
    title: string;
    sub: string;
    chip: string;
    chipTone: 'gold' | 'moss' | 'rust';
  }[] = [
    {
      key: 'water',
      icon: <IconDropFilled size={26} className={type === 'water' ? 'text-cream' : 'text-water'} />,
      title: dict.care.water,
      sub: due ? fill(dict.care.waterDue, { time: timeAgo(dueAt, locale) }) : dict.care.waterNotDue,
      chip: due ? `+${mult(verified ? POINTS.waterDue : POINTS.waterDueUnverified)}` : '·',
      chipTone: 'gold',
    },
    {
      key: 'photo',
      icon: <IconCamera size={26} className={type === 'photo' ? 'text-cream' : 'text-forest'} />,
      title: dict.care.photoUpdate,
      sub: dict.care.photoSub,
      chip: `+${mult(POINTS.photo)}`,
      chipTone: 'moss',
    },
    {
      key: 'harvest',
      icon: <IconBasket size={26} className={type === 'harvest' ? 'text-cream' : 'text-gold-deep'} />,
      title: dict.care.harvest,
      sub: dict.care.harvestSub,
      chip: fill(dict.care.upTo, { points: mult(POINTS.harvest) }),
      chipTone: 'gold',
    },
    inTrouble
      ? {
          key: 'resolve',
          icon: <IconCheck size={26} className={type === 'resolve' ? 'text-cream' : 'text-leaf'} />,
          title: dict.care.resolve,
          sub: dict.care.resolveSub,
          chip: `+${POINTS.resolve + POINTS.rescueBonus}`,
          chipTone: 'gold',
        }
      : {
          key: 'report',
          icon: <IconAlert size={26} className={type === 'report' ? 'text-cream' : 'text-rust'} />,
          title: dict.care.reportIssue,
          sub: dict.care.reportSub,
          chip: dict.care.paysWhenConfirmed,
          chipTone: 'rust',
        },
  ];

  function submit() {
    setError('');
    startTransition(async () => {
      const result = await logCareAction({
        plantId: plant.id,
        type,
        caption: caption || undefined,
        photoUrl: photoUrl || undefined,
        harvestQuantity: type === 'harvest' ? quantity || undefined : undefined,
      });
      if (result.ok) {
        setDone(result);
      } else {
        setError(actionMsg(result.error, dict) ?? dict.common.error);
      }
    });
  }

  if (done?.ok) {
    return (
      <KarmaMoment
        points={done.pointsAwarded ?? 0}
        note={done.note}
        breakdown={done.breakdown}
        newBadges={done.newBadges ?? []}
        userName={user.name}
        plantName={plant.name}
        onDone={() => {
          router.push(`/${locale}/plants/${plant.id}`);
          router.refresh();
        }}
      />
    );
  }

  const chipCls = {
    gold: 'bg-gold text-[#1D1607]',
    moss: 'bg-moss text-forest',
    rust: 'bg-rust-tint text-rust-ink',
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),56px)]">
      <div className="flex items-center justify-between pb-1.5 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={dict.common.close}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-line bg-card text-ink transition hover:bg-chip"
        >
          <IconClose size={16} />
        </button>
        <h1 className="font-display text-[24px] font-bold uppercase tracking-[0.04em] text-ink">
          {dict.care.title}
        </h1>
        <div className="w-[38px]" />
      </div>
      <p className="text-center text-[13px] text-muted-foreground">{plant.name}</p>

      {/* Action grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const active = type === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setType(tile.key)}
              className={`flex flex-col gap-2.5 rounded-[20px] p-[18px] text-start transition active:scale-[0.98] ${
                active
                  ? 'bg-forest shadow-[0_8px_24px_rgba(23,64,43,0.28)]'
                  : 'border border-line bg-card hover:border-bark'
              }`}
            >
              {tile.icon}
              <span className="flex flex-col gap-0.5">
                <span className={`text-[15px] font-bold ${active ? 'text-cream' : 'text-ink'}`}>{tile.title}</span>
                <span className={`text-[11.5px] ${active ? 'text-cream/65' : 'text-faint'}`}>{tile.sub}</span>
              </span>
              <span
                className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold ${chipCls[tile.chipTone]}`}
              >
                {tile.chip}
              </span>
            </button>
          );
        })}
      </div>

      {/* Photo */}
      <div className="mt-4">
        <PhotoInput name="photo" label={dict.care.attachPhoto} height={120} onChange={setPhotoUrl} />
      </div>

      {/* Harvest quantity */}
      {type === 'harvest' && (
        <label className="animate-rise mt-3 flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 focus-within:border-forest">
          <span className="microlabel text-bark">{dict.care.harvestAmount}</span>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={dict.care.harvestPlaceholder}
            maxLength={100}
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
          />
        </label>
      )}

      {/* Note */}
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder={dict.care.addNote}
        rows={2}
        maxLength={500}
        className="mt-3 w-full resize-none rounded-2xl border border-line bg-card px-[18px] py-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-forest"
      />

      {error && (
        <p className="animate-pop mt-3 rounded-2xl bg-rust-tint px-4 py-3 text-[13px] font-medium text-rust-ink">
          {error}
        </p>
      )}

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="w-full rounded-full bg-forest py-[17px] text-center text-[16px] font-semibold text-cream transition active:scale-[0.985] disabled:opacity-70"
        >
          {pending ? dict.care.logging : dict.care.logAction[type]}
        </button>
      </div>
    </div>
  );
}
