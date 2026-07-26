import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth-helpers';
import { getZoneBySlug, getZoneLeaderboard, listZonePosts } from '@/lib/social-data';
import { isFeedSort, type FeedSort } from '@/lib/social-kinds';
import { getDict, fill, isLocale, type Locale } from '@/i18n';
import { PostCard } from '@/components/community/post-card';
import { JoinZoneButton } from '@/components/community/join-zone-button';
import { Avatar } from '@/components/avatar';
import { IconBack } from '@/components/icons';

async function ZoneContent({
  slug,
  locale,
  sort,
}: {
  slug: string;
  locale: Locale;
  sort: FeedSort;
}) {
  const dict = getDict(locale);
  const user = await getSessionUser();
  const zone = await getZoneBySlug(slug);
  if (!zone) notFound();

  const [feed, leaders] = await Promise.all([
    listZonePosts(zone.id, sort, user?.id ?? null),
    getZoneLeaderboard(zone.id),
  ]);

  const name = locale === 'he' && zone.nameHe ? zone.nameHe : zone.name;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link
          href={`/${locale}/community`}
          className="flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-bark transition hover:text-ink"
        >
          <IconBack size={14} />
          {dict.community.title}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="animate-rise font-display text-[32px] font-bold uppercase leading-none text-ink">
            {name}
          </h1>
          {user && <JoinZoneButton zoneId={zone.id} />}
        </div>
        <p className="text-[12px] text-muted-foreground">
          {fill(dict.community.members, { n: zone.memberCount })} ·{' '}
          {fill(dict.community.posts, { n: zone.postCount })} ·{' '}
          {fill(dict.community.plantsHere, { n: zone.plantCount })}
        </p>
        {zone.description && (
          <p className="text-[13.5px] leading-relaxed text-ink">{zone.description}</p>
        )}
      </header>

      {/*
        The leaderboard lives here rather than as a global page. "Top gardeners
        in Givat Ada" is both more useful and more motivating than a worldwide
        ranking nobody can place themselves in.
      */}
      {leaders.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="microlabel text-bark">{dict.community.topGardeners}</h2>
          <div className="flex flex-wrap gap-2">
            {leaders.slice(0, 6).map((leader, index) => (
              <Link
                key={leader.id}
                href={`/${locale}/users/${leader.id}`}
                className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pe-3 ps-1 transition hover:border-bark"
              >
                <Avatar name={leader.displayName} id={leader.id} src={leader.avatar} size={24} />
                <span className="text-[12px] font-semibold text-ink">{leader.displayName}</span>
                <span className="stat-number text-[12px] text-gold-deep">{leader.karma}</span>
                {index === 0 && <span aria-hidden>👑</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-2">
        {(['hot', 'new', 'top'] as const).map((option) => (
          <Link
            key={option}
            href={`/${locale}/z/${slug}?sort=${option}`}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition ${
              sort === option ? 'bg-ink text-cream' : 'bg-card text-ink hover:bg-chip'
            }`}
          >
            {option === 'hot'
              ? dict.community.sortHot
              : option === 'new'
                ? dict.community.sortNew
                : dict.community.sortTop}
          </Link>
        ))}
      </div>

      {feed.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card/60 px-4 py-8 text-center text-[13px] text-muted-foreground">
          {dict.community.feedEmptyHint}
        </p>
      ) : (
        <div className="stagger flex flex-col gap-2.5">
          {feed.map((post) => (
            <PostCard key={post.id} post={post} locale={locale} dict={dict} showZone={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function ZoneSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-4 w-40" />
      <div className="skeleton h-[120px] rounded-2xl" />
      <div className="skeleton h-[120px] rounded-2xl" />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Derived from the slug, not the database: metadata runs outside Suspense,
  // where an uncached read blocks the whole route under cacheComponents.
  const pretty = slug.replace(/^cell-.*/, 'A patch of the map').replace(/-/g, ' ');
  return { title: pretty };
}

async function ParamsGate({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const [{ slug, locale: raw }, { sort: rawSort }] = await Promise.all([params, searchParams]);
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const sort: FeedSort = isFeedSort(rawSort ?? null) ? (rawSort as FeedSort) : 'hot';
  return <ZoneContent slug={slug} locale={locale} sort={sort} />;
}

export default function ZonePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[520px] bg-cream px-5 pb-32 pt-[max(env(safe-area-inset-top),56px)] shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense fallback={<ZoneSkeleton />}>
          <ParamsGate params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
