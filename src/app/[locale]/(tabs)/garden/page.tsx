import { Suspense } from 'react';
import Link from 'next/link';
import { getAdoptablesNear, getMyGarden } from '@/lib/data';
import { getMyGardens } from '@/lib/garden-data';
import { getSessionUser } from '@/lib/auth-helpers';
import { getInitialView } from '@/lib/map-view';
import { getDict, fill, isLocale, type Locale } from '@/i18n';
import { plantSubtitle } from '@/lib/msg';
import { PlantImage } from '@/components/plant-art';
import { PlantCard } from '@/components/plant/plant-card';
import { IconForward, IconHeartOutline, IconLeafPair } from '@/components/icons';

async function GardenContent({ locale }: { locale: Locale }) {
  const dict = getDict(locale);
  const user = await getSessionUser();
  if (!user) return null;

  // Ask the database for this viewer's plants rather than loading every plant
  // on earth and filtering in JS; "nearby" adoptables are now genuinely the
  // nearest ones, ordered by the GiST KNN operator.
  const view = await getInitialView();
  const [{ founded, stewarding }, adoptables, gardens] = await Promise.all([
    getMyGarden(user.id),
    getAdoptablesNear(view, user.id),
    getMyGardens(user.id),
  ]);

  // Plants filed into a garden are listed under that garden, not repeated in
  // the flat list — otherwise a 100-plant plot makes this page unusable.
  const looseFounded = founded.filter((p) => p.gardenId === null);
  const empty = founded.length === 0 && stewarding.length === 0 && gardens.length === 0;

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
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="microlabel text-bark">{dict.gardens.heading}</h2>
              <Link
                href={`/${locale}/gardens/new`}
                className="text-[12px] font-semibold text-leaf transition hover:text-forest"
              >
                + {dict.gardens.create}
              </Link>
            </div>
            {gardens.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-card/60 px-4 py-5 text-center text-[12.5px] leading-relaxed text-muted-foreground">
                {dict.gardens.empty2}
              </p>
            ) : (
              <div className="stagger flex flex-col gap-2.5">
                {gardens.map((garden) => (
                  <Link
                    key={garden.id}
                    href={`/${locale}/gardens/${garden.slug}`}
                    className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-3.5 transition hover:border-bark active:scale-[0.99]"
                  >
                    <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-moss text-forest">
                      <IconLeafPair size={24} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-display text-[18px] font-bold uppercase leading-tight text-ink">
                        {garden.name}
                      </span>
                      <span className="truncate text-[12px] text-muted-foreground">
                        {garden.plantCount === 1
                          ? dict.gardens.onePlant
                          : fill(dict.gardens.plantCount, { n: garden.plantCount })}
                      </span>
                    </div>
                    <IconForward size={14} className="shrink-0 text-bark" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {looseFounded.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="microlabel text-bark">
                {gardens.length > 0 ? dict.gardens.loose : dict.garden.founded}
              </h2>
              <div className="stagger flex flex-col gap-2.5">
                {looseFounded.map((plant) => (
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
                  <span className="truncate text-[11.5px] text-muted-foreground">
                    {plantSubtitle(plant, locale, dict)}
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
