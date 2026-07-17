'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/provider';
import { fill } from '@/i18n';
import type { LeaderboardRow } from '@/lib/types';
import { trustLevelFor } from '@/lib/karma';
import { formatNumber } from '@/lib/format';
import { Avatar } from '@/components/avatar';
import { IconCrown } from '@/components/icons';

function levelName(karma: number, dict: ReturnType<typeof useI18n>['dict']): string {
  const name = trustLevelFor(karma).name;
  return dict.levels[name as keyof typeof dict.levels] ?? name;
}

export function RanksBoard({ rows, viewerId }: { rows: LeaderboardRow[]; viewerId: number | null }) {
  const { dict, locale } = useI18n();
  const [range, setRange] = useState<'all' | 'week'>('all');

  const sorted = useMemo(() => {
    const list = [...rows];
    if (range === 'week') list.sort((a, b) => b.karma7d - a.karma7d || b.karma - a.karma);
    return list;
  }, [rows, range]);

  const value = (row: LeaderboardRow) => (range === 'week' ? row.karma7d : row.karma);
  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  // Visual order: 2nd, 1st, 3rd
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardRow[];

  if (rows.length === 0) {
    return <p className="mt-10 text-center text-[13.5px] text-muted-foreground">{dict.ranks.empty}</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[38px] font-bold uppercase leading-none text-ink">{dict.ranks.title}</h1>
        <div className="flex gap-0.5 rounded-full bg-chip p-1">
          {(['all', 'week'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`rounded-full px-3.5 py-[7px] text-[11.5px] font-bold transition ${
                range === key ? 'bg-white text-ink shadow-[0_1px_4px_rgba(32,37,28,0.1)]' : 'text-muted-foreground'
              }`}
            >
              {key === 'all' ? dict.ranks.allTime : dict.ranks.sevenDays}
            </button>
          ))}
        </div>
      </div>

      {/* Podium */}
      <div className="mt-7 flex items-end gap-2.5">
        {podiumOrder.map((row) => {
          const rank = sorted.indexOf(row) + 1;
          const first = rank === 1;
          return (
            <Link
              key={row.id}
              href={`/${locale}/users/${row.id}`}
              className={`flex flex-col items-center gap-2 ${first ? 'flex-[1.15]' : 'flex-1'}`}
            >
              <div className="relative">
                <Avatar name={row.displayName} id={row.id} src={row.avatar} size={first ? 68 : 56} ring={first} />
                {first && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-gold">
                    <IconCrown size={24} />
                  </span>
                )}
              </div>
              <span className="max-w-full truncate text-[12px] font-bold text-ink">{row.displayName}</span>
              <div
                className={`w-full rounded-t-[14px] text-center ${
                  first
                    ? 'border border-b-0 border-gold-line bg-gold-tint pb-3.5 pt-6'
                    : 'bg-[#EDE7D8] pb-3.5 pt-4'
                }`}
              >
                <div className={`stat-number ${first ? 'text-[38px] text-gold-deep' : 'text-[28px] text-soil'}`}>
                  {formatNumber(value(row), locale)}
                </div>
                <div className={`microlabel mt-1 ${first ? 'text-gold-deep' : 'text-bark'}`}>
                  {levelName(row.karma, dict)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="h-px bg-line" />

      {/* Rows */}
      <div className="stagger mt-3.5 flex flex-col gap-2">
        {rest.map((row) => {
          const rank = sorted.indexOf(row) + 1;
          const isViewer = row.id === viewerId;
          return (
            <Link
              key={row.id}
              href={`/${locale}/users/${row.id}`}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition active:scale-[0.99] ${
                isViewer ? 'border-[1.5px] border-leaf bg-moss' : 'border border-line bg-card hover:border-bark'
              }`}
            >
              <span className={`w-5 shrink-0 font-display text-[17px] font-bold ${isViewer ? 'text-forest' : 'text-bark'}`}>
                {rank}
              </span>
              <Avatar name={row.displayName} id={row.id} src={row.avatar} size={38} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={`truncate text-[13.5px] font-bold ${isViewer ? 'text-forest' : 'text-ink'}`}>
                  {row.displayName}
                  {isViewer && ` · ${dict.ranks.you}`}
                </span>
                <span className={`text-[11px] ${isViewer ? 'text-[#4E7C5E]' : 'text-faint'}`}>
                  {levelName(row.karma, dict)} · {row.badges.length === 1 ? dict.badges.countOne : fill(dict.badges.count, { n: row.badges.length })}
                </span>
              </div>
              <div className="text-end">
                <div className={`stat-number text-[22px] ${isViewer ? 'text-forest' : 'text-ink'}`}>
                  {formatNumber(value(row), locale)}
                </div>
                <div
                  className={`text-[10px] font-bold ${row.karma7d > 0 ? 'text-leaf' : 'text-faint'}`}
                >
                  {row.karma7d > 0 ? fill(dict.ranks.thisWeek, { points: row.karma7d }) : '—'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
