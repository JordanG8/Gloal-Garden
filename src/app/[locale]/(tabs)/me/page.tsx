import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-helpers';
import { getUserProfile, getBadgeProgress } from '@/lib/profile-data';
import { isLocale, type Locale } from '@/i18n';
import { ProfileView } from '@/components/profile/profile-view';
import { MeActions } from '@/components/profile/me-actions';

export const unstable_instant = {
  prefetch: 'runtime',
  samples: [{ params: { locale: 'en' } }, { params: { locale: 'he' } }],
};

async function MeContent({ locale }: { locale: Locale }) {
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/welcome`);
  const [profile, badgeProgress] = await Promise.all([
    getUserProfile(user.id),
    getBadgeProgress(user.id),
  ]);
  if (!profile) redirect(`/${locale}/welcome`);

  return (
    <ProfileView
      profile={profile}
      badgeProgress={badgeProgress}
      locale={locale}
      actions={<MeActions verificationRequired={user.verificationRequired} />}
    />
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="skeleton h-[72px] w-[72px] rounded-full" />
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-3.5 w-52" />
        </div>
      </div>
      <div className="skeleton h-40 rounded-[22px]" />
      <div className="grid grid-cols-3 gap-2.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-[84px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function MePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';

  return (
    <div className="flex-1 px-5 pb-32 pt-[max(env(safe-area-inset-top),56px)]">
      <Suspense fallback={<ProfileSkeleton />}>
        <MeContent locale={locale} />
      </Suspense>
    </div>
  );
}
