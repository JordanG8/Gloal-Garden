import Link from 'next/link';
import type { UserProfile } from '@/lib/types';
import type { BadgeMetric } from '@/lib/karma';
import { BADGES, trustLevelFor, nextTrustLevel } from '@/lib/karma';
import { getDict, fill, type Locale } from '@/i18n';
import { formatNumber, monthYear, timeAgo } from '@/lib/format';
import { Avatar } from '@/components/avatar';
import { LevelChip } from '@/components/pills';
import { LevelBar } from '@/components/stat';
import { BadgeTile } from '@/components/badge-art';
import { IconForward } from '@/components/icons';

/** The profile body shared by /me and /users/[id] (design 4.1). */
export function ProfileView({
  profile,
  badgeProgress,
  locale,
  actions,
}: {
  profile: UserProfile;
  badgeProgress: Partial<Record<BadgeMetric, number>>;
  locale: Locale;
  actions?: React.ReactNode;
}) {
  const dict = getDict(locale);
  const level = trustLevelFor(profile.karma);
  const next = nextTrustLevel(profile.karma);
  const percent = next
    ? ((profile.karma - level.minKarma) / (next.minKarma - level.minKarma)) * 100
    : 100;
  const levelName = (name: string) => dict.levels[name as keyof typeof dict.levels] ?? name;

  const stats = [
    { value: profile.stats.plantsFounded, label: dict.profile.plants },
    { value: profile.stats.waterings, label: dict.profile.waterings },
    { value: profile.stats.harvests, label: dict.profile.harvests, gold: true },
    { value: profile.stats.photos, label: dict.profile.photos },
    { value: profile.stats.rescues, label: dict.profile.rescues },
    { value: profile.badges.length, label: dict.profile.badgesTitle },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="animate-rise flex items-center gap-4">
        <Avatar name={profile.displayName} id={profile.id} src={profile.avatar} size={72} ring />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-display text-[32px] font-bold uppercase leading-none text-ink">
            {profile.displayName}
          </h1>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {[profile.location, fill(dict.profile.gardeningSince, { date: monthYear(profile.createdAt, locale) })]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="flex gap-1.5">
            <LevelChip label={levelName(level.name)} />
            <LevelChip label={fill(dict.badges.count, { n: profile.badges.length })} gold />
          </div>
        </div>
      </div>

      {profile.bio && (
        <p className="animate-rise text-[13.5px] leading-relaxed text-soil-ink [animation-delay:0.04s]">
          {profile.bio}
        </p>
      )}

      {/* Karma card */}
      <div className="animate-rise flex flex-col gap-3.5 rounded-[22px] bg-forest p-[22px] [animation-delay:0.08s]">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="stat-number text-[58px] text-gold-bright">{formatNumber(profile.karma, locale)}</div>
            <div className="microlabel mt-1 text-cream/55">{dict.profile.karma}</div>
          </div>
          <div className="text-end">
            <div className="stat-number text-[28px] text-cream">+{formatNumber(profile.karma7d, locale)}</div>
            <div className="microlabel mt-1 text-cream/55">{dict.profile.thisWeek}</div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <LevelBar percent={percent} dark />
          <div className="flex justify-between gap-2 text-[11px] font-semibold text-cream/60">
            <span>{levelName(level.name)}</span>
            {next ? (
              <span>
                {fill(dict.karma.toGo, { points: next.minKarma - profile.karma })} ·{' '}
                {levelName(next.name)} — {fill(dict.levels.perk, { n: next.adoptionCap })}
              </span>
            ) : (
              <span>{dict.karma.maxLevel}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="animate-rise grid grid-cols-3 gap-2.5 [animation-delay:0.12s]">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-card px-1.5 py-3.5 text-center">
            <div className={`stat-number text-[30px] ${stat.gold ? 'text-gold-deep' : 'text-ink'}`}>
              {formatNumber(stat.value, locale)}
            </div>
            <div className="microlabel mt-1 text-bark">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div className="flex items-baseline justify-between pt-1">
        <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.05em] text-ink">
          {dict.profile.badgesTitle}
        </h2>
        <span className="text-[11.5px] font-semibold text-muted-foreground">
          {fill(dict.badges.of, { have: profile.badges.length, all: BADGES.length })}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {BADGES.map((badge) => (
          <BadgeTile
            key={badge.id}
            id={badge.id}
            dict={dict}
            earned={profile.badges.includes(badge.id)}
            progress={{ have: badgeProgress[badge.metric] ?? 0, need: badge.threshold }}
          />
        ))}
      </div>

      {/* Stewardships */}
      {profile.stewardships.length > 0 && (
        <>
          <h2 className="pt-1 font-display text-[20px] font-bold uppercase tracking-[0.05em] text-ink">
            {dict.profile.myPlants}
          </h2>
          <div className="flex flex-col gap-2">
            {profile.stewardships.slice(0, 6).map((s) => (
              <Link
                key={s.plantId}
                href={`/${locale}/plants/${s.plantId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 transition hover:border-bark"
              >
                <span className="truncate text-[13.5px] font-semibold text-ink">{s.plantName}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {!s.active && (
                    <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold text-faint uppercase">
                      {dict.garden.inactive}
                    </span>
                  )}
                  <IconForward size={13} className="text-faint" />
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Recent events */}
      {profile.recentEvents.length > 0 && (
        <>
          <h2 className="pt-1 font-display text-[20px] font-bold uppercase tracking-[0.05em] text-ink">
            {dict.profile.recent}
          </h2>
          <div className="flex flex-col gap-1.5">
            {profile.recentEvents.slice(0, 8).map((event) => {
              const label = dict.karma.breakdown[event.kind as keyof typeof dict.karma.breakdown] ?? event.kind;
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3.5 py-2.5"
                >
                  <span className="min-w-0 truncate text-[12.5px] text-ink">
                    {label}
                    {event.plantName && <span className="text-muted-foreground"> · {event.plantName}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-[12px] font-bold tabular-nums ${
                        event.points > 0 ? 'text-gold-deep' : 'text-faint'
                      }`}
                    >
                      {event.points > 0 ? `+${event.points}` : '·'}
                    </span>
                    <span className="text-[10.5px] text-faint">{timeAgo(event.createdAt, locale)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {actions}
    </div>
  );
}
