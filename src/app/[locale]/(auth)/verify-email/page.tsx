import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyEmailWithToken } from '@/lib/auth-actions';
import { ResendVerification } from '@/components/auth/auth-forms';
import { getDict, isLocale, type Locale, type Dictionary } from '@/i18n';
import { IconMail, IconCheck, IconAlert } from '@/components/icons';

export const unstable_instant = {
  prefetch: 'runtime',
  samples: [
    { params: { locale: 'en' }, searchParams: { token: null } },
    { params: { locale: 'he' }, searchParams: { token: null } },
  ],
};

function Illustration({ kind }: { kind: 'mail' | 'check' | 'expired' }) {
  const tones = {
    mail: { bg: 'bg-moss', fg: 'text-forest' },
    check: { bg: 'bg-gold-tint', fg: 'text-gold-deep' },
    expired: { bg: 'bg-rust-tint', fg: 'text-rust' },
  }[kind];
  const Icon = kind === 'mail' ? IconMail : kind === 'check' ? IconCheck : IconAlert;
  return (
    <div className={`animate-pop mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] ${tones.bg}`}>
      <Icon size={44} className={tones.fg} />
    </div>
  );
}

async function VerifyContent({
  searchParams,
  dict,
  locale,
}: {
  searchParams: Promise<{ token?: string }>;
  dict: Dictionary;
  locale: string;
}) {
  const { token } = await searchParams;

  if (token) {
    const ok = await verifyEmailWithToken(token);
    if (ok) {
      return (
        <div className="flex flex-col items-center gap-5 text-center">
          <Illustration kind="check" />
          <h1 className="font-display text-[44px] font-bold leading-none text-ink">{dict.auth.verifiedTitle}</h1>
          <p className="text-[14.5px] text-muted-foreground">{dict.auth.verifiedSub}</p>
          <Link
            href={`/${locale}`}
            className="w-full rounded-full bg-forest py-4 text-center text-[16px] font-semibold text-cream transition active:scale-[0.985]"
          >
            {dict.auth.toTheGarden}
          </Link>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <Illustration kind="expired" />
        <h1 className="font-display text-[44px] font-bold leading-none text-ink">{dict.auth.verifyFailedTitle}</h1>
        <p className="text-[14.5px] text-muted-foreground">{dict.auth.verifyFailedSub}</p>
        <div className="w-full">
          <ResendVerification />
        </div>
        <Link href={`/${locale}`} className="text-[14px] font-bold text-forest">
          {dict.auth.toTheGarden}
        </Link>
      </div>
    );
  }

  // No token: the post-signup "check your inbox" state.
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : NaN;
  let email = session?.user?.email ?? '';
  let verified = false;
  if (Number.isFinite(userId)) {
    try {
      const [row] = await db
        .select({ email: users.email, verifiedAt: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (row) {
        email = row.email;
        verified = !!row.verifiedAt;
      }
    } catch (error) {
      console.error('verify page lookup failed:', error);
    }
  }

  if (verified) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <Illustration kind="check" />
        <h1 className="font-display text-[44px] font-bold leading-none text-ink">{dict.auth.verifiedTitle}</h1>
        <p className="text-[14.5px] text-muted-foreground">{dict.auth.verifiedSub}</p>
        <Link
          href={`/${locale}`}
          className="w-full rounded-full bg-forest py-4 text-center text-[16px] font-semibold text-cream transition active:scale-[0.985]"
        >
          {dict.auth.toTheGarden}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Illustration kind="mail" />
      <h1 className="font-display text-[44px] font-bold leading-none text-ink">{dict.auth.verifyTitle}</h1>
      <p className="text-[14.5px] leading-relaxed text-muted-foreground">
        {dict.auth.verifySent}
        {email ? (
          <>
            <br />
            <strong className="text-ink" dir="ltr">
              {email}
            </strong>
          </>
        ) : null}
        <br />
        {dict.auth.verifySub}
      </p>
      <div className="w-full">
        <ResendVerification />
      </div>
      <Link href={`/${locale}`} className="text-[14px] font-bold text-forest">
        {dict.auth.toTheGarden}
      </Link>
    </div>
  );
}

export default async function VerifyEmailPage({
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
    <div className="flex flex-1 flex-col justify-center px-7 py-16">
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-5">
            <div className="skeleton h-24 w-24 rounded-[28px]" />
            <div className="skeleton h-10 w-56" />
            <div className="skeleton h-14 w-full rounded-full" />
          </div>
        }
      >
        <VerifyContent searchParams={searchParams} dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
