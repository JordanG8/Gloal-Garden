import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getUserProfile, getBadgeProgress } from '@/lib/profile-data';
import { isLocale, type Locale } from '@/i18n';
import { ProfileView } from '@/components/profile/profile-view';
import { BackButton } from '@/components/plant/back-button';

async function UserContent({ id, locale }: { id: number; locale: Locale }) {
  const [profile, badgeProgress] = await Promise.all([getUserProfile(id), getBadgeProgress(id)]);
  if (!profile) notFound();
  return <ProfileView profile={profile} badgeProgress={badgeProgress} locale={locale} />;
}

async function ParamsGate({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id: rawId } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id)) notFound();
  return (
    <>
      <div className="relative h-14">
        <BackButton locale={locale} tone="page" />
      </div>
      <div className="px-5 pb-16 pt-2">
        <UserContent id={id} locale={locale} />
      </div>
    </>
  );
}

export default function UserPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative mx-auto min-h-dvh w-full max-w-[520px] bg-cream shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense
          fallback={
            <div className="flex flex-col gap-4 px-5 pt-16">
              <div className="skeleton h-[72px] w-[72px] rounded-full" />
              <div className="skeleton h-40 rounded-[22px]" />
            </div>
          }
        >
          <ParamsGate params={params} />
        </Suspense>
      </div>
    </div>
  );
}
