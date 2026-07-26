import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-helpers';
import { getInitialView } from '@/lib/map-view';
import { CreateGardenFlow } from '@/components/garden/create-garden-flow';

async function NewGardenContent({ locale }: { locale: string }) {
  // Same viewport the map was last on, so the picker opens where you are
  // rather than somewhere you have to pan away from.
  const [user, view] = await Promise.all([getSessionUser(), getInitialView()]);
  if (!user) redirect(`/${locale}/welcome`);

  return <CreateGardenFlow center={{ lat: view.lat, lng: view.lng }} />;
}

function NewGardenSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="skeleton h-9 w-9 rounded-full" />
        <div className="skeleton h-7 w-40" />
        <div className="w-9" />
      </div>
      <div className="skeleton h-[180px] w-full rounded-[18px]" />
      <div className="skeleton h-14 w-full rounded-2xl" />
      <div className="skeleton h-16 w-full rounded-2xl" />
      <div className="skeleton h-14 w-full rounded-2xl" />
    </div>
  );
}

export default async function NewGardenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[520px] bg-cream px-5 pb-16 pt-[max(env(safe-area-inset-top),56px)] shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense fallback={<NewGardenSkeleton />}>
          <NewGardenContent locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
