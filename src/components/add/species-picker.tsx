'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import type { SpeciesOption } from '@/lib/species-data';

/**
 * Type a plant name; pick a match from the catalogue if there is one, keep the
 * free text if there isn't.
 *
 * Picking a real species is what makes seasonal watering and calendar harvest
 * windows work — a free-typed plant inherits a flat default. But the app was
 * shipped with free text on purpose (the species list was removed because it
 * got in the way), so this must never become a required step.
 */
export function SpeciesPicker({
  value,
  onChange,
  catalog,
}: {
  value: { name: string; speciesId: number | null };
  onChange: (next: { name: string; speciesId: number | null }) => void;
  catalog: SpeciesOption[];
}) {
  const { dict, locale } = useI18n();
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const q = value.name.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.nameHe ?? '').includes(value.name.trim()) ||
          s.scientificName.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [catalog, value.name]);

  const selected = value.speciesId
    ? catalog.find((s) => s.id === value.speciesId) ?? null
    : null;

  const displayName = (s: SpeciesOption) =>
    locale === 'he' && s.nameHe ? s.nameHe : s.name;

  return (
    <div className="relative flex flex-col gap-1">
      <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
        <span className="microlabel text-bark">{dict.add.plantName}</span>
        <div className="flex items-center gap-2">
          {selected && <span aria-hidden className="text-[18px]">{selected.emoji}</span>}
          <input
            value={value.name}
            onChange={(e) => {
              // Typing after a pick clears the pick — the text no longer
              // necessarily describes the chosen species.
              onChange({ name: e.target.value, speciesId: null });
            }}
            onFocus={() => setFocused(true)}
            // Delayed so a click on a suggestion registers before the list closes.
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            maxLength={80}
            placeholder={dict.add.plantNamePlaceholder}
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
          />
        </div>
      </label>

      {selected && (
        <p className="px-1 text-[11.5px] text-leaf">
          {dict.add.speciesMatched} · {selected.scientificName}
        </p>
      )}

      {focused && !selected && matches.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_8px_28px_rgba(32,37,28,0.18)]">
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange({ name: displayName(s), speciesId: s.id })}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start transition hover:bg-moss"
              >
                <span aria-hidden className="text-[18px]">{s.emoji}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] text-ink">{displayName(s)}</span>
                  <span className="truncate text-[11px] italic text-faint">
                    {s.scientificName}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
