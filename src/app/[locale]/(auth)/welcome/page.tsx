import { Suspense } from 'react';
import { db } from '@/db';
import { users, plants, observations } from '@/db/schema';
import { eq, ne, sql } from 'drizzle-orm';
import { getDict, isLocale, type Locale } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { WelcomePager } from '@/components/auth/welcome-pager';

export const unstable_instant = {
  prefetch: 'runtime',
  samples: [{ params: { locale: 'en' } }, { params: { locale: 'he' } }],
};

async function CommunityStats({ locale }: { locale: Locale }) {
  const dict = getDict(locale);
  let counts = { plants: 0, gardeners: 0, harvests: 0 };
  try {
    const [row] = await db
      .select({
        plants: sql<number>`(select count(*) from ${plants} where ${ne(plants.status, 'removed')})::int`,
        gardeners: sql<number>`(select count(*) from ${users})::int`,
        harvests: sql<number>`(select count(*) from ${observations} where ${eq(observations.type, 'harvest')})::int`,
      })
      .from(sql`(select 1) as one`);
    if (row) counts = row;
  } catch (error) {
    console.error('Community stats unavailable:', error);
  }

  const stats = [
    { value: formatNumber(counts.plants, locale), label: dict.welcome.statPlants, gold: false },
    { value: formatNumber(counts.gardeners, locale), label: dict.welcome.statGardeners, gold: false },
    { value: formatNumber(counts.harvests, locale), label: dict.welcome.statHarvests, gold: true },
  ];

  return (
    <div className="flex gap-6 border-y border-cream/15 py-3.5">
      {stats.map((stat) => (
        <div key={stat.label}>
          <div className={`stat-number text-[28px] ${stat.gold ? 'text-gold-bright' : 'text-cream'}`}>
            {stat.value}
          </div>
          <div className="microlabel mt-0.5 text-cream/50">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="flex gap-6 border-y border-cream/15 py-3.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-7 w-14 rounded-md bg-cream/10" />
          <div className="h-2.5 w-16 rounded bg-cream/10" />
        </div>
      ))}
    </div>
  );
}

export default async function WelcomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';

  return (
    <WelcomePager
      locale={locale}
      stats={
        <Suspense fallback={<StatsSkeleton />}>
          <CommunityStats locale={locale} />
        </Suspense>
      }
    />
  );
}
