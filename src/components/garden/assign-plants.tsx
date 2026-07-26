'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { assignPlantToGarden } from '@/lib/garden-actions';
import { actionMsg } from '@/lib/msg';
import { MAX_BED_LABEL } from '@/lib/garden-kinds';

/**
 * Files loose plants into this garden, optionally onto a bed.
 *
 * Follows the direct-call-in-useTransition style of add-plant-flow.tsx rather
 * than useActionState, because the action returns an ActionResult that has to
 * be surfaced as a localized message.
 */
export function AssignPlants({
  gardenId,
  plants,
}: {
  gardenId: number;
  plants: { id: number; name: string }[];
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bedLabel, setBedLabel] = useState('');
  const [error, setError] = useState('');

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (selected.size === 0) return;
    setError('');
    startTransition(async () => {
      // Sequential rather than Promise.all: each call is its own batch, and
      // firing a dozen writes at the database at once for a UI convenience is
      // not worth the contention.
      for (const plantId of selected) {
        const res = await assignPlantToGarden({
          plantId,
          gardenId,
          bedLabel: bedLabel.trim() || null,
        });
        if (!res.ok) {
          setError(actionMsg(res.error, dict) ?? dict.common.error);
          return;
        }
      }
      setSelected(new Set());
      setBedLabel('');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-full border border-line bg-card px-4 py-2 text-[12.5px] font-semibold text-ink transition hover:border-bark active:scale-95"
      >
        + {dict.gardens.addPlants}
      </button>
    );
  }

  return (
    <section className="animate-rise flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="microlabel text-bark">{dict.gardens.assignTitle}</h2>
      <p className="text-[12px] text-muted-foreground">{dict.gardens.assignHint}</p>

      <div className="flex flex-col gap-1.5">
        {plants.map((plant) => {
          const checked = selected.has(plant.id);
          return (
            <button
              key={plant.id}
              type="button"
              onClick={() => toggle(plant.id)}
              aria-pressed={checked}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition ${
                checked ? 'border-forest bg-moss' : 'border-line bg-white/60 hover:border-bark'
              }`}
            >
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-[10px] text-cream ${
                  checked ? 'border-forest bg-forest' : 'border-bark'
                }`}
              >
                {checked ? '✓' : ''}
              </span>
              <span className="truncate text-[13px] text-ink">{plant.name}</span>
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-white px-[18px] py-3 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
        <span className="microlabel text-bark">{dict.gardens.bedLabel}</span>
        <input
          value={bedLabel}
          onChange={(e) => setBedLabel(e.target.value)}
          maxLength={MAX_BED_LABEL}
          placeholder={dict.gardens.bedPlaceholder}
          className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      {error && <p className="text-[12.5px] font-semibold text-rust">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.size === 0}
          className="flex-1 rounded-full bg-forest px-5 py-3 text-[14px] font-semibold text-cream transition disabled:opacity-50"
        >
          {pending ? dict.gardens.saving : dict.gardens.assignSave}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-line px-5 py-3 text-[14px] font-semibold text-ink"
        >
          {dict.common.cancel}
        </button>
      </div>
    </section>
  );
}
