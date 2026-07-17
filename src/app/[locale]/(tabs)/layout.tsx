import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { TabBar } from '@/components/tab-bar';

export const unstable_instant = false;

/**
 * Signed-out visitors get bounced to the onboarding flow. Runs inside
 * Suspense so tab shells stay instantly navigable.
 */
async function AuthGate({ locale }: { locale: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/welcome`);
  }
  return null;
}

export default async function TabsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[520px] flex-col bg-cream shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense fallback={null}>
          <AuthGate locale={locale} />
        </Suspense>
        {children}
        <TabBar />
      </div>
    </div>
  );
}
