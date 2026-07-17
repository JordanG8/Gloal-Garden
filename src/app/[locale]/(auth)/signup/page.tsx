import Link from 'next/link';
import { getDict, isLocale, type Locale } from '@/i18n';
import { AuthHeader } from '@/components/auth/auth-header';
import { SignupForm } from '@/components/auth/auth-forms';

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const dict = getDict(locale);

  return (
    <div className="flex flex-1 flex-col px-7 pb-10 pt-16">
      <AuthHeader
        locale={locale}
        appName={dict.app.name}
        title1={dict.auth.joinTitle1}
        title2={dict.auth.joinTitle2}
        sub={dict.auth.joinSub}
        backHref={`/${locale}/welcome`}
      />
      <div className="mt-8 animate-rise [animation-delay:0.08s]">
        <SignupForm />
      </div>
      <p className="mt-auto pt-8 text-center text-[14px] text-muted-foreground">
        {dict.auth.alreadyHave}{' '}
        <Link href={`/${locale}/login`} className="font-bold text-forest hover:text-gold-deep">
          {dict.auth.signInInstead}
        </Link>
      </p>
    </div>
  );
}
