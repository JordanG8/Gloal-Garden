'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { fill } from '@/i18n';
import { adoptPlant, abandonPlant } from '@/lib/adoption-actions';
import { actionMsg } from '@/lib/msg';

export function AdoptButton({ plantId, adopted }: { plantId: number; adopted: boolean }) {
  const { dict } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState('');

  function run() {
    startTransition(async () => {
      const result = adopted ? await abandonPlant(plantId) : await adoptPlant(plantId);
      if (result.ok) {
        setNote(
          adopted
            ? dict.plant.unadoptedToast
            : fill(dict.plant.adoptedToast, { points: result.pointsAwarded ?? 0 })
        );
        router.refresh();
        setTimeout(() => setNote(''), 3500);
      } else {
        setNote(actionMsg(result.error, dict) ?? dict.common.error);
        setTimeout(() => setNote(''), 3500);
      }
    });
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition active:scale-95 disabled:opacity-60 ${
          adopted
            ? 'border border-line text-muted-foreground hover:bg-chip'
            : 'border-[1.5px] border-gold text-gold-deep hover:bg-gold-tint'
        }`}
      >
        {adopted ? dict.plant.unadopt : dict.plant.adopt}
      </button>
      {note && (
        <div className="animate-pop absolute end-0 top-full z-20 mt-2 w-56 rounded-xl bg-ink px-3.5 py-2.5 text-[12px] font-medium text-cream shadow-lg">
          {note}
        </div>
      )}
    </div>
  );
}
