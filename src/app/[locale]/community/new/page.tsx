import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-helpers';
import { getInitialView } from '@/lib/map-view';
import { listZonesNear } from '@/lib/social-data';
import { isLocale, type Locale } from '@/i18n';
import { ComposePost } from '@/components/community/compose-post';

async function ComposeContent({ locale }: { locale: Locale }) {
  const [user, view] = await Promise.all([getSessionUser(), getInitialView()]);
  if (!user) redirect(`/${locale}/welcome`);

  // Show which community the post will land in, resolved from the viewport
  // rather than asked for — the nearest zone is almost always the right one.
  const nearby = await listZonesNear(view, 1);
  const zone = nearby[0]
    ? { id: nearby[0].id, name: locale === 'he' && nearby[0].nameHe ? nearby[0].nameHe : nearby[0].name }
    : null;

  return <ComposePost zone={zone} at={{ lat: view.lat, lng: view.lng }} />;
}

function ComposeSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton h-9 w-full" />
      <div className="skeleton h-10 w-full rounded-full" />
      <div className="skeleton h-14 w-full rounded-2xl" />
      <div className="skeleton h-32 w-full rounded-2xl" />
    </div>
  );
}

export default async function NewPostPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[520px] bg-cream px-5 pb-16 pt-[max(env(safe-area-inset-top),56px)] shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense fallback={<ComposeSkeleton />}>
          <ComposeContent locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
