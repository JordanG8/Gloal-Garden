'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { fill } from '@/i18n';
import type { KarmaBreakdown } from '@/lib/types';
import { trustLevelFor, nextTrustLevel } from '@/lib/karma';
import { actionMsg } from '@/lib/msg';
import { BadgeGlyph, badgeName, badgeDesc } from '@/components/badge-art';
import { LevelBar } from '@/components/stat';

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/**
 * Full-screen celebration (design 3.3): counted-up gold points, the earning
 * breakdown, badge unlocks, and progress toward the next trust level.
 */
export function KarmaMoment({
  points,
  note,
  breakdown,
  newBadges,
  userName,
  plantName,
  doneLabel,
  onDone,
}: {
  points: number;
  note?: string;
  breakdown?: KarmaBreakdown;
  newBadges: string[];
  userName: string;
  plantName?: string;
  doneLabel?: string;
  onDone: () => void;
}) {
  const { dict, locale } = useI18n();
  const shown = useCountUp(points);

  const totalKarma = breakdown?.totalKarma ?? 0;
  const level = trustLevelFor(totalKarma);
  const next = nextTrustLevel(totalKarma);
  const levelBefore = trustLevelFor(totalKarma - points);
  const leveledUp = level.level > levelBefore.level;
  const percent = next
    ? ((totalKarma - level.minKarma) / (next.minKarma - level.minKarma)) * 100
    : 100;
  const levelName = (name: string) => dict.levels[name as keyof typeof dict.levels] ?? name;
  const kindLabel =
    breakdown && dict.karma.breakdown[breakdown.kind as keyof typeof dict.karma.breakdown];

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-canvas">
      <div className="relative flex h-full w-full max-w-[520px] flex-col items-center overflow-y-auto bg-[linear-gradient(175deg,#0F2E1E_0%,#17402B_70%,#1B4A32_100%)] px-7 pb-11 pt-[max(env(safe-area-inset-top),64px)]">
        <div className="pointer-events-none absolute top-24 start-1/2 h-[440px] w-[440px] -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,162,43,.3),rgba(201,162,43,0)_65%)]" />

        <div className="relative flex flex-col items-center gap-1">
          <div className="animate-fade text-[12px] font-bold uppercase tracking-[0.22em] text-cream/60">
            {fill(dict.karma.niceWork, { name: userName })}
          </div>
          <div
            className="animate-glow stat-number text-[130px] text-gold-bright"
            style={{ textShadow: '0 0 60px rgba(201,162,43,.45)' }}
          >
            {points > 0 ? `+${shown}` : '✓'}
          </div>
          <div className="font-display text-[22px] font-semibold uppercase tracking-[0.24em] text-cream">
            {points > 0 ? dict.karma.earned : dict.karma.noPoints}
          </div>
        </div>

        {/* Breakdown */}
        {breakdown && (
          <div className="animate-rise relative mt-8 flex w-full flex-col gap-3 rounded-[20px] border border-cream/15 bg-cream/[0.07] p-5 [animation-delay:0.15s]">
            {breakdown.base > 0 && (
              <div className="flex justify-between gap-3 text-[13.5px] text-cream/85">
                <span>{kindLabel ?? breakdown.kind}</span>
                <strong className="text-cream tabular-nums">+{breakdown.base}</strong>
              </div>
            )}
            {breakdown.communityBonus > 0 && (
              <div className="flex justify-between gap-3 text-[13.5px] text-cream/85">
                <span>{dict.karma.neighborBonus}</span>
                <strong className="text-gold-bright tabular-nums">+{breakdown.communityBonus}</strong>
              </div>
            )}
            {breakdown.rescueBonus > 0 && (
              <div className="flex justify-between gap-3 text-[13.5px] text-cream/85">
                <span>{dict.karma.breakdown.rescue_bonus}</span>
                <strong className="text-gold-bright tabular-nums">+{breakdown.rescueBonus}</strong>
              </div>
            )}
            {note && <div className="text-[12.5px] leading-normal text-cream/60">{actionMsg(note, dict)}</div>}
            <div className="h-px bg-cream/12" />
            <div className="flex justify-between gap-3 text-[13.5px] text-cream/85">
              <span>{plantName ? fill(dict.karma.saysThanks, { name: plantName }) : dict.profile.karma}</span>
              <strong className="text-cream tabular-nums">
                {fill(dict.karma.total, { total: new Intl.NumberFormat(locale).format(totalKarma) })}
              </strong>
            </div>
          </div>
        )}

        {/* Badge unlocks */}
        {newBadges.map((badge, i) => (
          <div
            key={badge}
            className="animate-pop relative mt-3.5 flex w-full items-center gap-3.5 rounded-[20px] bg-gold p-4 shadow-[0_12px_32px_rgba(201,162,43,0.35)]"
            style={{ animationDelay: `${0.35 + i * 0.15}s` }}
          >
            <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#1D1607]">
              <BadgeGlyph id={badge} size={24} />
            </div>
            <div className="flex flex-col gap-px">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#1D1607]/60">
                {dict.karma.badgeUnlocked}
              </span>
              <span className="font-display text-[21px] font-bold uppercase tracking-[0.03em] text-[#1D1607]">
                {badgeName(badge, dict)}
              </span>
              <span className="text-[11.5px] text-[#1D1607]/70">{badgeDesc(badge, dict)}</span>
            </div>
          </div>
        ))}

        {/* Level progress + done */}
        <div className="relative mt-auto flex w-full flex-col gap-4 pt-8">
          {leveledUp && (
            <div className="animate-pop flex items-center justify-center gap-2 rounded-2xl border border-gold/60 bg-gold/15 py-3 text-center font-display text-[20px] font-bold uppercase tracking-[0.2em] text-gold-bright">
              ★ {dict.karma.levelUp} · {levelName(level.name)}
            </div>
          )}
          {breakdown && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-cream/60">
                <span>{levelName(level.name)}</span>
                <span>
                  {next
                    ? fill(dict.karma.toNext, { name: levelName(next.name), points: next.minKarma })
                    : dict.karma.maxLevel}
                </span>
              </div>
              <LevelBar percent={percent} dark />
              {next && (
                <div className="text-end text-[11.5px] text-cream/55">
                  {fill(dict.karma.toGo, { points: next.minKarma - totalKarma })}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onDone}
            className="w-full rounded-full bg-cream py-4 text-center text-[16px] font-bold text-forest transition active:scale-[0.985]"
          >
            {doneLabel ?? dict.karma.backToGarden}
          </button>
        </div>
      </div>
    </div>
  );
}
