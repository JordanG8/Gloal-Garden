import Link from 'next/link';
import { getDict, isLocale, type Locale } from '@/i18n';
import { AuthHeader } from '@/components/auth/auth-header';
import { ForgotPasswordForm } from '@/components/auth/auth-forms';

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const dict = getDict(locale);

  return (
    <div className="flex flex-1 flex-col px-7 pb-10 pt-16">
      <AuthHeader
        locale={locale}
        appName={dict.app.name}
        title1={dict.auth.forgotTitle1}
        title2={dict.auth.forgotTitle2}
        sub={dict.auth.forgotSub}
        backHref={`/${locale}/login`}
      />
      <div className="mt-8 animate-rise [animation-delay:0.08s]">
        <ForgotPasswordForm />
      </div>
      <p className="mt-auto pt-8 text-center text-[14px]">
        <Link href={`/${locale}/login`} className="font-bold text-forest hover:text-gold-deep">
          {dict.auth.backToLogin}
        </Link>
      </p>
    </div>
  );
}
