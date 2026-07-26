import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-helpers';
import { getInitialView } from '@/lib/map-view';
import { getSpeciesCatalog } from '@/lib/species-data';
import { AddPlantFlow } from '@/components/add/add-plant-flow';

async function AddContent({ locale }: { locale: string }) {
  // Open the spot picker on the map you were just looking at. This used to
  // average every plant's coordinates, which required loading the whole table
  // and pointed at open water once the data covered more than one town.
  const [user, view, catalog] = await Promise.all([
    getSessionUser(),
    getInitialView(),
    getSpeciesCatalog(),
  ]);
  if (!user) redirect(`/${locale}/welcome`);

  return (
    <AddPlantFlow user={user} center={{ lat: view.lat, lng: view.lng }} catalog={catalog} />
  );
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
