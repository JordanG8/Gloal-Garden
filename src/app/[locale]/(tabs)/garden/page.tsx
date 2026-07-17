import { Suspense } from 'react';
import Link from 'next/link';
import { db } from '@/db';
import { adoptions, plants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getGardenData } from '@/lib/data';
import { getSessionUser } from '@/lib/auth-helpers';
import { getDict, fill, isLocale, type Locale, type Dictionary } from '@/i18n';
import type { PlantSummary } from '@/lib/types';
import { speciesDisplayName } from '@/lib/msg';
import { timeAgo } from '@/lib/format';
import { StatusPill } from '@/components/pills';
import { PlantImage } from '@/components/plant-art';
import { pinStatus } from '@/components/map/plant-marker';
import { IconForward, IconHeartOutline } from '@/components/icons';

export const unstable_instant = {
  prefetch: 'runtime',
  samples: [{ params: { locale: 'en' } }, { params: { locale: 'he' } }],
};

function PlantCard({ plant, locale, dict }: { plant: PlantSummary; locale: Locale; dict: Dictionary }) {
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
        <span className="truncate font-display text-[18px] font-bold uppercase leading-tight text-ink">
          {plant.name}
        </span>
        <span className="truncate text-[12px] text-muted-foreground">
          {speciesDisplayName(plant, locale)}
          {plant.lastWateredAt &&
            ` · ${fill(dict.garden.lastCare, { time: timeAgo(plant.lastWateredAt, locale) })}`}
        </span>
      </div>
      <StatusPill status={pinStatus(plant) as never} dict={dict} className="shrink-0 scale-90" />
    </Link>
  );
}

async function GardenContent({ locale }: { locale: Locale }) {
  const dict = getDict(locale);
  const [user, { plants: allPlants }] = await Promise.all([getSessionUser(), getGardenData()]);
  if (!user) return null;

  let adoptedIds: number[] = [];
  try {
    const rows = await db
      .select({ plantId: adoptions.plantId })
      .from(adoptions)
      .where(eq(adoptions.userId, user.id));
    adoptedIds = rows.map((r) => r.plantId);
  } catch (error) {
    console.error('garden adoptions failed:', error);
  }

  const founded = allPlants.filter((p) => p.founderId === user.id);
  const stewarding = allPlants.filter((p) => adoptedIds.includes(p.id) && p.founderId !== user.id);
  const adoptables = allPlants
    .filter((p) => p.upForAdoption && p.founderId !== user.id && !adoptedIds.includes(p.id))
    .slice(0, 4);
  const empty = founded.length === 0 && stewarding.length === 0;

  return (
    <>
      {empty ? (
        <div className="animate-pop mt-16 flex flex-col items-center gap-4 px-8 text-center">
          <span className="animate-float text-[64px]">🌱</span>
          <p className="font-display text-[26px] font-bold uppercase text-ink">{dict.garden.empty1}</p>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">{dict.garden.empty2}</p>
          <Link
            href={`/${locale}/add`}
            className="mt-2 rounded-full bg-forest px-8 py-3.5 text-[15px] font-semibold text-cream"
          >
            {dict.garden.plantFirst}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {founded.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="microlabel text-bark">{dict.garden.founded}</h2>
              <div className="stagger flex flex-col gap-2.5">
                {founded.map((plant) => (
                  <PlantCard key={plant.id} plant={plant} locale={locale} dict={dict} />
                ))}
              </div>
            </section>
          )}
          {stewarding.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="microlabel text-bark">{dict.garden.stewarding}</h2>
              <div className="stagger flex flex-col gap-2.5">
                {stewarding.map((plant) => (
                  <PlantCard key={plant.id} plant={plant} locale={locale} dict={dict} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {adoptables.length > 0 && (
        <section className="mt-6 flex flex-col gap-2.5">
          <h2 className="microlabel flex items-center gap-1.5 text-steward">
            <IconHeartOutline size={13} />
            {dict.garden.adoptables}
          </h2>
          <div className="stagger flex flex-col gap-2.5">
            {adoptables.map((plant) => (
              <Link
                key={plant.id}
                href={`/${locale}/plants/${plant.id}`}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-[#C9BFA8] bg-[#F6F3EA] px-4 py-3 transition hover:border-steward"
              >
                <PlantImage
                  photoUrl={plant.latestPhotoUrl}
                  category={plant.category}
                  emoji={plant.emoji}
                  alt={plant.name}
                  className="h-11 w-11 shrink-0 rounded-xl"
                  emojiSize={20}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-bold text-ink">{plant.name}</span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {speciesDisplayName(plant, locale)}
                  </span>
                </div>
                <IconForward size={14} className="shrink-0 text-steward" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function GardenSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-[88px] rounded-2xl" />
      <div className="skeleton h-[88px] rounded-2xl" />
      <div className="skeleton h-[88px] rounded-2xl" />
    </div>
  );
}

export default async function GardenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const dict = getDict(locale);

  return (
    <div className="flex-1 px-5 pb-32 pt-[max(env(safe-area-inset-top),56px)]">
      <h1 className="animate-rise font-display text-[38px] font-bold uppercase leading-none text-ink">
        {dict.garden.title}
      </h1>
      <div className="mt-5">
        <Suspense fallback={<GardenSkeleton />}>
          <GardenContent locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
