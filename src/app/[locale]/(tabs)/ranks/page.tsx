import { Suspense } from 'react';
import { getLeaderboard } from '@/lib/profile-data';
import { getSessionUser } from '@/lib/auth-helpers';
import { RanksBoard } from '@/components/ranks/ranks-board';

export const unstable_instant = {
  prefetch: 'runtime',
  samples: [{ params: { locale: 'en' } }, { params: { locale: 'he' } }],
};

async function RanksContent() {
  const [rows, user] = await Promise.all([getLeaderboard(), getSessionUser()]);
  return <RanksBoard rows={rows} viewerId={user?.id ?? null} />;
}

function RanksSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-9 w-32 rounded-full" />
      </div>
      <div className="flex items-end gap-2.5">
        <div className="skeleton h-32 flex-1 rounded-t-[14px]" />
        <div className="skeleton h-44 flex-[1.15] rounded-t-[14px]" />
        <div className="skeleton h-28 flex-1 rounded-t-[14px]" />
      </div>
      <div className="skeleton h-16 rounded-2xl" />
      <div className="skeleton h-16 rounded-2xl" />
    </div>
  );
}

export default function RanksPage() {
  return (
    <div className="flex-1 px-5 pb-32 pt-[max(env(safe-area-inset-top),56px)]">
      <Suspense fallback={<RanksSkeleton />}>
        <RanksContent />
      </Suspense>
    </div>
  );
}
