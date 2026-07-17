import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getGardenData } from '@/lib/data';
import { getSessionUser } from '@/lib/auth-helpers';
import { AddPlantFlow } from '@/components/add/add-plant-flow';

export const unstable_instant = {
  prefetch: 'runtime',
  samples: [{ params: { locale: 'en' } }, { params: { locale: 'he' } }],
};

const FALLBACK_CENTER = { lat: 32.5185, lng: 35.0047 };

async function AddContent({ locale }: { locale: string }) {
  const [user, { plants, speciesList }] = await Promise.all([getSessionUser(), getGardenData()]);
  if (!user) redirect(`/${locale}/welcome`);

  const center =
    plants.length > 0
      ? {
          lat: plants.reduce((sum, p) => sum + p.lat, 0) / plants.length,
          lng: plants.reduce((sum, p) => sum + p.lng, 0) / plants.length,
        }
      : FALLBACK_CENTER;

  return <AddPlantFlow speciesList={speciesList} user={user} center={center} />;
}

function AddSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col gap-4 px-6 pb-10 pt-[max(env(safe-area-inset-top),64px)]">
      <div className="flex items-center justify-between">
        <div className="skeleton h-9 w-9 rounded-full" />
        <div className="skeleton h-7 w-36" />
        <div className="w-9" />
      </div>
      <div className="skeleton h-[180px] w-full rounded-[18px]" />
      <div className="skeleton h-14 w-full rounded-2xl" />
      <div className="skeleton h-14 w-full rounded-2xl" />
      <div className="skeleton h-14 w-full rounded-2xl" />
      <div className="skeleton h-[104px] w-full rounded-2xl" />
    </div>
  );
}

export default async function AddPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative mx-auto w-full max-w-[520px] bg-cream shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense fallback={<AddSkeleton />}>
          <AddContent locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
