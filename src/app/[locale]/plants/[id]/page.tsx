import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlantDetail, getViewerAdoptedPlantIds } from '@/lib/data';
import { getSessionUser } from '@/lib/auth-helpers';
import { getDict, fill, isLocale, type Locale, type Dictionary } from '@/i18n';
import { speciesDisplayName } from '@/lib/msg';
import { daysBetween, timeAgo } from '@/lib/format';
import { StatusPill, GlassPill, KarmaChip } from '@/components/pills';
import { StatCardRow } from '@/components/stat';
import { Avatar } from '@/components/avatar';
import { PlantImage } from '@/components/plant-art';
import { ViewT } from '@/components/vt';
import { AdoptButton } from '@/components/plant/adopt-button';
import { BackButton } from '@/components/plant/back-button';
import { pinStatus } from '@/components/map/plant-marker';
import { IconPin, IconCamera, IconDropFilled, IconBasketFilled, IconAlert, IconCheck, IconForward } from '@/components/icons';
import type { ObservationEntry } from '@/lib/types';

export const unstable_instant = false;

function FeedLine({ entry, dict, locale }: { entry: ObservationEntry; dict: Dictionary; locale: Locale }) {
  const icons: Record<string, React.ReactNode> = {
    water: <IconDropFilled size={13} className="text-water" />,
    photo: <IconCamera size={13} className="text-forest" />,
    harvest: <IconBasketFilled size={13} className="text-gold-deep" />,
    alert: <IconAlert size={13} className="text-rust" />,
    resolve: <IconCheck size={13} className="text-leaf" />,
  };
  const labels: Record<string, string> = {
    water: dict.feed.watered,
    photo: dict.feed.photoUpdate,
    harvest: dict.feed.harvested,
    alert: dict.feed.reported,
    resolve: dict.feed.resolved,
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3">
      <Avatar name={entry.userName} id={entry.userId} src={entry.userAvatar} size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[13px] text-ink">
          <strong>{entry.userName}</strong>{' '}
          <span className="inline-flex translate-y-px items-center">{icons[entry.type]}</span>{' '}
          {labels[entry.type] ?? entry.type}
          {entry.harvestQuantity && (
            <strong className="text-gold-deep"> · {entry.harvestQuantity}</strong>
          )}
        </span>
        {entry.caption && <span className="truncate text-[12px] text-muted-foreground">“{entry.caption}”</span>}
        <span className="text-[11px] text-faint">{timeAgo(entry.createdAt, locale)}</span>
      </div>
      {entry.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-[10px] object-cover" />
      ) : (
        <KarmaChip points={entry.points} />
      )}
    </div>
  );
}

async function PlantContent({ id, locale }: { id: number; locale: Locale }) {
  const dict = getDict(locale);
  const [detail, user] = await Promise.all([getPlantDetail(id), getSessionUser()]);
  if (!detail) notFound();
  const adoptedIds = user ? await getViewerAdoptedPlantIds(user.id) : [];

  const { plant, observations, stewards, verified } = detail;
  const ageDays = daysBetween(plant.plantedAt);
  const waterings = observations.filter((o) => o.type === 'water').length;
  const harvests = observations.filter((o) => o.type === 'harvest').length;
  const founderSteward = stewards.length > 0;
  const isFounder = user?.id === plant.founderId;
  const adopted = adoptedIds.includes(plant.id);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Hero */}
      <div className="relative h-[300px] shrink-0 overflow-hidden bg-forest">
        <ViewT name={`plant-hero-${plant.id}`}>
          <PlantImage
            photoUrl={plant.latestPhotoUrl}
            category={plant.category}
            emoji={plant.emoji}
            alt={plant.name}
            className="h-full w-full"
            emojiSize={84}
          />
        </ViewT>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,46,30,.45)_0%,rgba(15,46,30,0)_35%,rgba(15,46,30,0)_55%,rgba(15,46,30,.82)_100%)]" />
        <BackButton locale={locale} />
        <div className="absolute inset-x-5 bottom-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <StatusPill status={pinStatus(plant) as never} dict={dict} />
            {verified && <GlassPill>{dict.status.verified}</GlassPill>}
          </div>
          <h1 className="font-display text-[40px] font-bold uppercase leading-[0.98] text-cream">{plant.name}</h1>
          <p className="text-[13px] text-cream/80">
            {speciesDisplayName(plant, locale)} · <em>{plant.scientificName}</em> ·{' '}
            {fill(dict.sheet.plantedBy, { name: plant.plantedByName })}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 pb-28 pt-4">
        {/* Stats */}
        <div className="animate-rise">
          <StatCardRow
            stats={[
              { value: ageDays, label: dict.plant.daysOld },
              { value: waterings, label: dict.plant.waterings },
              { value: harvests, label: dict.plant.harvests, gold: true },
            ]}
          />
        </div>

        {/* Stewards + adopt */}
        <div className="animate-rise flex items-center justify-between gap-3 [animation-delay:0.06s]">
          <div className="flex min-w-0 items-center gap-2.5">
            {founderSteward ? (
              <>
                <div className="flex shrink-0">
                  {stewards.slice(0, 3).map((steward, i) => (
                    <span key={steward.id} className={i > 0 ? '-ms-2.5' : ''}>
                      <Avatar
                        name={steward.name}
                        id={steward.id}
                        src={steward.avatar}
                        size={34}
                        ring={i === 0}
                        className="border-2 border-cream"
                      />
                    </span>
                  ))}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[12.5px] font-bold text-ink">
                    {stewards.map((s) => s.name).join(` ${dict.common.and} `)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{dict.plant.stewardsOf}</span>
                </div>
              </>
            ) : (
              <span className="text-[12.5px] text-muted-foreground">{dict.plant.noStewardYet}</span>
            )}
          </div>
          {user && !isFounder && <AdoptButton plantId={plant.id} adopted={adopted} />}
        </div>

        {/* Access notes */}
        {(plant.accessNotes || plant.description) && (
          <div className="animate-rise flex items-start gap-2.5 rounded-[14px] bg-soil-tint px-4 py-3 [animation-delay:0.1s]">
            <IconPin size={15} className="mt-0.5 shrink-0 text-soil" />
            <span className="text-[12px] leading-normal text-soil-ink">
              {[plant.description, plant.accessNotes].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}

        {/* Log care CTA */}
        <Link
          href={`/${locale}/plants/${plant.id}/care`}
          className="animate-rise flex items-center justify-center gap-2 rounded-full bg-forest py-4 text-[15px] font-semibold text-cream transition active:scale-[0.985] [animation-delay:0.13s]"
        >
          {dict.plant.logCare}
          <IconForward size={14} />
        </Link>

        {/* Activity */}
        <div className="flex items-baseline justify-between pt-1">
          <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.05em] text-ink">
            {dict.plant.activity}
          </h2>
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            {observations.length} {dict.plant.entries}
          </span>
        </div>
        {observations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted-foreground">
            {dict.plant.emptyFeed}
          </p>
        ) : (
          <div className="stagger flex flex-col gap-2.5">
            {observations.slice(0, 30).map((entry) => (
              <FeedLine key={entry.id} entry={entry} dict={dict} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlantSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="skeleton h-[300px] w-full rounded-none" />
      <div className="flex flex-col gap-4 px-5 pt-4">
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="skeleton h-10 w-2/3 rounded-xl" />
        <div className="skeleton h-14 w-full rounded-full" />
        <div className="skeleton h-20 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default async function PlantPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id: rawId } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id)) notFound();

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative mx-auto w-full max-w-[520px] bg-cream shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense fallback={<PlantSkeleton />}>
          <PlantContent id={id} locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
