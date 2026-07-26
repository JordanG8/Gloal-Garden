import { Suspense } from 'react';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth-helpers';
import { getInitialView } from '@/lib/map-view';
import { getHomeFeed, listZonesNear } from '@/lib/social-data';
import { isFeedSort, type FeedSort } from '@/lib/social-kinds';
import { getDict, fill, isLocale, type Locale } from '@/i18n';
import { PostCard } from '@/components/community/post-card';
import { IconPlus } from '@/components/icons';

async function CommunityContent({ locale, sort }: { locale: Locale; sort: FeedSort }) {
  const dict = getDict(locale);
  // The feed is scoped to where you are, which is the entire point — a
  // gardening community that isn't local isn't a community.
  const [user, view] = await Promise.all([getSessionUser(), getInitialView()]);
  const [feed, nearby] = await Promise.all([
    getHomeFeed(user?.id ?? null, view, sort),
    listZonesNear(view),
  ]);

  return (
    <div className="flex flex-col gap-5">
      {nearby.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="microlabel text-bark">{dict.community.nearYou}</h2>
          <div className="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {nearby.map((zone) => (
              <Link
                key={zone.id}
                href={`/${locale}/z/${zone.slug}`}
                className="flex shrink-0 flex-col gap-0.5 rounded-2xl border border-line bg-card px-4 py-2.5 transition hover:border-bark"
              >
                <span className="whitespace-nowrap text-[13px] font-bold text-ink">
                  {locale === 'he' && zone.nameHe ? zone.nameHe : zone.name}
                </span>
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  {fill(dict.community.posts, { n: zone.postCount })}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-2">
        {(['hot', 'new', 'top'] as const).map((option) => (
          <Link
            key={option}
            href={`/${locale}/community?sort=${option}`}
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
        <div className="animate-pop mt-10 flex flex-col items-center gap-3 px-6 text-center">
          <span className="animate-float text-[52px]">🍋</span>
          <p className="font-display text-[22px] font-bold uppercase text-ink">
            {dict.community.feedEmpty}
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {dict.community.feedEmptyHint}
          </p>
        </div>
      ) : (
        <div className="stagger flex flex-col gap-2.5">
          {feed.map((post) => (
            <PostCard key={post.id} post={post} locale={locale} dict={dict} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-[120px] rounded-2xl" />
      <div className="skeleton h-[120px] rounded-2xl" />
      <div className="skeleton h-[120px] rounded-2xl" />
    </div>
  );
}

/**
 * Awaits params and searchParams inside Suspense. Under `cacheComponents`,
 * reading either in the page body is uncached data outside a boundary, which
 * blocks the whole route from rendering and fails the build.
 */
async function ParamsGate({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const [{ locale: raw }, { sort: rawSort }] = await Promise.all([params, searchParams]);
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const sort: FeedSort = isFeedSort(rawSort ?? null) ? (rawSort as FeedSort) : 'hot';
  const dict = getDict(locale);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="animate-rise font-display text-[38px] font-bold uppercase leading-none text-ink">
          {dict.community.title}
        </h1>
        <Link
          href={`/${locale}/community/new`}
          className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-[12.5px] font-semibold text-cream transition active:scale-95"
        >
          <IconPlus size={14} />
          {dict.community.newPost}
        </Link>
      </div>
      <div className="mt-5">
        <CommunityContent locale={locale} sort={sort} />
      </div>
    </>
  );
}

export default function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  return (
    <div className="flex-1 px-5 pb-32 pt-[max(env(safe-area-inset-top),56px)]">
      <Suspense fallback={<FeedSkeleton />}>
        <ParamsGate params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
