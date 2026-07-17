import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getPlantDetail } from '@/lib/data';
import { getSessionUser } from '@/lib/auth-helpers';
import { CareFlow } from '@/components/care/care-flow';

export const unstable_instant = false;

async function CareContent({
  id,
  locale,
  searchParams,
}: {
  id: number;
  locale: string;
  searchParams: Promise<{ action?: string }>;
}) {
  const [detail, user, { action }] = await Promise.all([
    getPlantDetail(id),
    getSessionUser(),
    searchParams,
  ]);
  if (!detail) notFound();
  if (!user) redirect(`/${locale}/welcome`);

  return <CareFlow plant={detail.plant} user={user} initialAction={action} />;
}

function CareSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col gap-4 px-6 pt-[max(env(safe-area-inset-top),64px)]">
      <div className="mx-auto skeleton h-7 w-32" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-36 rounded-[20px]" />
        <div className="skeleton h-36 rounded-[20px]" />
        <div className="skeleton h-36 rounded-[20px]" />
        <div className="skeleton h-36 rounded-[20px]" />
      </div>
      <div className="skeleton h-[120px] rounded-2xl" />
    </div>
  );
}

export default async function CarePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { locale, id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id)) notFound();

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative mx-auto w-full max-w-[520px] bg-cream shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense fallback={<CareSkeleton />}>
          <CareContent id={id} locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
