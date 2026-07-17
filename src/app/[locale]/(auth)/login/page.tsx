import { Suspense } from 'react';
import Link from 'next/link';
import { getDict, isLocale, type Locale } from '@/i18n';
import { AuthHeader } from '@/components/auth/auth-header';
import { LoginForm } from '@/components/auth/auth-forms';
import { googleSignInEnabled } from '@/auth';

async function FormWithNotes({ searchParams }: { searchParams: Promise<{ reset?: string; verified?: string }> }) {
  const { reset, verified } = await searchParams;
  return <LoginForm reset={reset === '1'} verified={verified === '1'} googleEnabled={googleSignInEnabled} />;
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reset?: string; verified?: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const dict = getDict(locale);

  return (
    <div className="flex flex-1 flex-col px-7 pb-10 pt-16">
      <AuthHeader
        locale={locale}
        appName={dict.app.name}
        title1={dict.auth.welcomeBack}
        sub={dict.auth.missedYou}
        backHref={`/${locale}/welcome`}
      />
      <div className="mt-8 animate-rise [animation-delay:0.08s]">
        <Suspense fallback={<LoginForm googleEnabled={googleSignInEnabled} />}>
          <FormWithNotes searchParams={searchParams} />
        </Suspense>
      </div>
      <p className="mt-auto pt-8 text-center text-[14px] text-muted-foreground">
        {dict.auth.newHere}{' '}
        <Link href={`/${locale}/signup`} className="font-bold text-forest hover:text-gold-deep">
          {dict.auth.createAccount}
        </Link>
      </p>
    </div>
  );
}
