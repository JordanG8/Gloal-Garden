import Link from 'next/link';
import { fill, type Dictionary, type Locale } from '@/i18n';
import type { PlantSummary } from '@/lib/types';
import { speciesDisplayName } from '@/lib/msg';
import { timeAgo } from '@/lib/format';
import { StatusPill } from '@/components/pills';
import { PlantImage } from '@/components/plant-art';
import { pinStatus } from '@/lib/plant-status';

/**
 * The standard plant row: thumbnail, name, subtitle, status pill. Lifted out of
 * the Garden tab so the garden detail page renders identical cards instead of a
 * near-copy that drifts.
 *
 * Server component — takes `dict` as a prop rather than calling `useI18n()`,
 * matching pills.tsx / stat.tsx / avatar.tsx.
 */
export function PlantCard({
  plant,
  locale,
  dict,
}: {
  plant: PlantSummary;
  locale: Locale;
  dict: Dictionary;
}) {
  const species = speciesDisplayName(plant, locale);
  const subtitle = [
    species === plant.name ? null : species,
    // A pin standing for a row of plants should say so.
    plant.quantity > 1 ? fill(dict.gardens.plantCount, { n: plant.quantity }) : null,
    plant.lastWateredAt &&
      fill(dict.garden.lastCare, { time: timeAgo(plant.lastWateredAt, locale) }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/${locale}/plants/${plant.id}`}
      className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-3 transition hover:border-bark active:scale-[0.99]"
    >
      <PlantImage
        photoUrl={plant.latestPhotoUrl}
        category={plant.category}
        emoji={plant.emoji}
        alt={plant.name}
        className="h-[64px] w-[64px] shrink-0 rounded-[14px]"
        emojiSize={26}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 font-display text-[18px] font-bold uppercase leading-tight text-ink">
          {plant.name}
        </span>
        <span className="truncate text-[12px] text-muted-foreground">{subtitle}</span>
      </div>
      <StatusPill status={pinStatus(plant)} dict={dict} className="shrink-0 scale-90" />
    </Link>
  );
}
