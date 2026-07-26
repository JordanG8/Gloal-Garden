import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGardenDetail, getGardenMeta, getUnassignedPlants } from '@/lib/garden-data';
import { getSessionUser } from '@/lib/auth-helpers';
import { getDict, fill, isLocale, type Locale, type Dictionary } from '@/i18n';
import { PlantCard } from '@/components/plant/plant-card';
import { Avatar } from '@/components/avatar';
import { AssignPlants } from '@/components/garden/assign-plants';
import { WaterBedButton } from '@/components/garden/water-bed-button';
import { IconBack, IconLeafPair } from '@/components/icons';

function plantCountLabel(n: number, dict: Dictionary): string {
  return n === 1 ? dict.gardens.onePlant : fill(dict.gardens.plantCount, { n });
}

async function GardenContent({ slug, locale }: { slug: string; locale: Locale }) {
  const dict = getDict(locale);
  const user = await getSessionUser();
  const detail = await getGardenDetail(slug, user?.id ?? null);
  if (!detail) notFound();

  const { garden, beds, dueCount, members, viewerCanManage } = detail;
  // Only fetched when it can actually be used, so a visitor's page view doesn't
  // pay for a query whose result is never rendered.
  const unassigned = viewerCanManage ? await getUnassignedPlants(user!.id) : [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link
          href={`/${locale}/garden`}
          className="flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-bark transition hover:text-ink"
        >
          <IconBack size={14} />
          {dict.garden.title}
        </Link>
        <h1 className="animate-rise font-display text-[34px] font-bold uppercase leading-none text-ink">
          {garden.name}
        </h1>
        <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <IconLeafPair size={14} />
          {plantCountLabel(garden.plantCount, dict)}
          {' · '}
          {dict.gardens[
            garden.kind === 'community'
              ? 'kindCommunity'
              : garden.kind === 'plot'
                ? 'kindPlot'
                : 'kindPatch'
          ]}
        </p>
        {garden.description && (
          <p className="text-[13.5px] leading-relaxed text-ink">{garden.description}</p>
        )}
      </header>

      {/*
        One tap waters everything that's actually due. Mandatory once a plot
        has a hundred plants — nobody taps through a hundred care flows, and
        the realistic alternative is that people stop logging entirely.
      */}
      {user && dueCount > 0 && <WaterBedButton gardenId={garden.id} dueCount={dueCount} />}

      {members.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="microlabel text-bark">{dict.gardens.keepers}</h2>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <Link
                key={member.id}
                href={`/${locale}/users/${member.id}`}
                className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pe-3 ps-1 transition hover:border-bark"
              >
                <Avatar name={member.name} id={member.id} src={member.avatar} size={26} />
                <span className="text-[12.5px] font-semibold text-ink">{member.name}</span>
                <span className="microlabel text-faint">
                  {member.role === 'keeper' ? dict.gardens.keeper : dict.gardens.member}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {viewerCanManage && unassigned.length > 0 && (
        <AssignPlants gardenId={garden.id} plants={unassigned} />
      )}

      {beds.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card/60 px-4 py-8 text-center text-[13px] text-muted-foreground">
          {dict.gardens.noPlants}
        </p>
      ) : (
        beds.map((bed) => (
          <section key={bed.label ?? '__unfiled__'} className="flex flex-col gap-2.5">
            {/*
              A single unnamed group is just "the garden" — no point labelling it.
              Once beds exist, the leftovers get their own honest heading.
            */}
            {(bed.label !== null || beds.length > 1) && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="microlabel text-bark">{bed.label ?? dict.gardens.unfiled}</h2>
                {user && beds.length > 1 && (
                  <WaterBedButton
                    gardenId={garden.id}
                    bedLabel={bed.label}
                    dueCount={bed.dueCount}
                  />
                )}
              </div>
            )}
            <div className="stagger flex flex-col gap-2.5">
              {bed.plants.map((plant) => (
                <PlantCard key={plant.id} plant={plant} locale={locale} dict={dict} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function GardenSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-9 w-56" />
      <div className="skeleton h-4 w-36" />
      <div className="skeleton h-[88px] rounded-2xl" />
      <div className="skeleton h-[88px] rounded-2xl" />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Cached read — metadata runs outside Suspense, where an uncached query
  // would block the whole route from rendering.
  const meta = await getGardenMeta(slug);
  if (!meta) return {};
  return { title: meta.name, description: meta.description ?? undefined };
}

/** Awaits params inside Suspense, matching the ParamsGate pattern used by /plants/[id]. */
async function ParamsGate({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  return <GardenContent slug={slug} locale={locale} />;
}

export default function GardenDetailPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[520px] bg-cream px-5 pb-32 pt-[max(env(safe-area-inset-top),56px)] shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense fallback={<GardenSkeleton />}>
          <ParamsGate params={params} />
        </Suspense>
      </div>
    </div>
  );
}
