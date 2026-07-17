import { Suspense } from 'react';
import Link from 'next/link';
import { getDict, isLocale, type Locale, type Dictionary } from '@/i18n';
import { AuthHeader } from '@/components/auth/auth-header';
import { ResetPasswordForm } from '@/components/auth/auth-forms';

async function TokenGate({
  searchParams,
  dict,
  locale,
}: {
  searchParams: Promise<{ token?: string }>;
  dict: Dictionary;
  locale: string;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-2xl bg-rust-tint px-4 py-3 text-[13px] font-medium text-rust-ink">
          {dict.auth.resetInvalid}
        </p>
        <Link
          href={`/${locale}/forgot-password`}
          className="w-full rounded-full bg-forest py-4 text-center text-[16px] font-semibold text-cream"
        >
          {dict.auth.requestNew}
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const dict = getDict(locale);

  return (
    <div className="flex flex-1 flex-col px-7 pb-10 pt-16">
      <AuthHeader
        locale={locale}
        appName={dict.app.name}
        title1={dict.auth.resetTitle1}
        title2={dict.auth.resetTitle2}
        sub={dict.auth.resetSub}
        backHref={`/${locale}/login`}
      />
      <div className="mt-8 animate-rise [animation-delay:0.08s]">
        <Suspense fallback={<div className="skeleton h-40 w-full" />}>
          <TokenGate searchParams={searchParams} dict={dict} locale={locale} />
        </Suspense>
      </div>
      <p className="mt-auto pt-8 text-center text-[14px]">
        <Link href={`/${locale}/login`} className="font-bold text-forest hover:text-gold-deep">
          {dict.auth.backToLogin}
        </Link>
      </p>
    </div>
  );
}
