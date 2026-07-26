'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { fill } from '@/i18n';
import { waterBatch } from '@/lib/batch-care-actions';
import { actionMsg } from '@/lib/msg';
import { IconDrop } from '@/components/icons';

/**
 * "Water everything due here", for a whole garden or one bed.
 *
 * At a hundred plants nobody is going to tap through a hundred care flows, and
 * the honest alternative is that people stop logging altogether — which loses
 * the data the rest of the app is built on.
 *
 * Only offers what's actually due, so it can't be used to blanket-stamp a
 * garden as watered.
 */
export function WaterBedButton({
  gardenId,
  bedLabel,
  dueCount,
}: {
  gardenId: number;
  /** Omit for the whole garden; null targets plants with no bed. */
  bedLabel?: string | null;
  dueCount: number;
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState('');

  if (dueCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult('');
            const res = await waterBatch({ gardenId, bedLabel, onlyDue: true });
            if (res.ok) {
              setResult(
                fill(dict.gardens.wateredCount, {
                  n: res.watered ?? 0,
                  points: res.pointsAwarded ?? 0,
                })
              );
              router.refresh();
            } else {
              setResult(actionMsg(res.error, dict) ?? dict.common.error);
            }
          })
        }
        className="flex items-center gap-1.5 rounded-full bg-water px-4 py-2 text-[12.5px] font-semibold text-white transition active:scale-95 disabled:opacity-50"
      >
        <IconDrop size={14} />
        {pending
          ? dict.gardens.watering
          : bedLabel === undefined
            ? fill(dict.gardens.waterGarden, { n: dueCount })
            : fill(dict.gardens.waterBed, { n: dueCount })}
      </button>
      {result && <span className="text-[12px] font-semibold text-leaf">{result}</span>}
    </div>
  );
}
