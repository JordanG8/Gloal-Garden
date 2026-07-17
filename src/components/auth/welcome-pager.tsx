'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { setLocaleAction } from '@/lib/profile-actions';
import { LeafMark } from '@/components/logo';
import { IconPin, IconDrop, IconStar, IconGlobe } from '@/components/icons';

function LangToggle({ dark = false }: { dark?: boolean }) {
  const { locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const other = locale === 'he' ? 'en' : 'he';

  async function toggle() {
    await setLocaleAction(other);
    router.replace(pathname.replace(/^\/(en|he)/, `/${other}`));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition active:scale-95 ${
        dark ? 'bg-cream/10 text-cream/85 hover:bg-cream/20' : 'bg-chip text-forest hover:bg-line'
      }`}
      aria-label="Switch language"
    >
      <IconGlobe size={15} />
      {other === 'he' ? 'עברית' : 'English'}
    </button>
  );
}

export { LangToggle };

/**
 * First-run flow: dark hero (screen 1.1) → how it works (1.2) → auth CTAs.
 * A horizontal slider with spring easing; state stays client-side so the
 * whole thing feels like a native onboarding.
 */
export function WelcomePager({ locale, stats }: { locale: string; stats: ReactNode }) {
  const { dict } = useI18n();
  const [page, setPage] = useState(0);

  return (
    <div className="relative h-dvh overflow-hidden">
      <div
        className="flex h-full transition-transform duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: `translateX(calc(${page * -100}% * var(--dir, 1)))` }}
      >
        {/* ---- 1.1 Hero ---- */}
        <section className="relative flex h-full w-full shrink-0 flex-col overflow-hidden bg-[linear-gradient(168deg,#17402B_0%,#0F2E1E_62%,#0B2417_100%)] px-7 pb-12 pt-16">
          <div className="pointer-events-none absolute -end-40 -top-36 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(201,162,43,.22),rgba(201,162,43,0)_68%)]" />
          <div className="pointer-events-none absolute -bottom-16 -start-24 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(59,132,85,.25),rgba(59,132,85,0)_70%)]" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-cream/10 animate-float">
                <LeafMark size={16} />
              </div>
              <span className="font-display text-[19px] font-semibold uppercase tracking-[0.14em] text-[#DCE7D6]">
                {dict.app.name}
              </span>
            </div>
            <LangToggle dark />
          </div>

          <div className="relative mt-auto flex flex-col gap-5">
            <h1 className="animate-rise font-display text-[68px] font-bold leading-[0.95] tracking-[0.01em] text-cream">
              {dict.welcome.headline1}
              <br />
              {dict.welcome.headline2}
              <br />
              <span className="text-gold">{dict.welcome.headline3}</span>
              <br />
              {dict.welcome.headline4}
            </h1>
            <p className="max-w-[300px] text-[16px] leading-[1.55] text-cream/70">{dict.welcome.sub}</p>

            {stats}

            <div className="flex flex-col gap-3 pb-2">
              <button
                type="button"
                onClick={() => setPage(1)}
                className="w-full rounded-full bg-gold py-[17px] text-center text-[16px] font-bold text-[#1D1607] transition active:scale-[0.985]"
              >
                {dict.welcome.getStarted}
              </button>
              <Link
                href={`/${locale}/login`}
                className="w-full rounded-full border-[1.5px] border-cream/30 py-[15px] text-center text-[15px] font-semibold text-cream transition hover:bg-cream/5 active:scale-[0.985]"
              >
                {dict.welcome.haveAccount}
              </Link>
            </div>
          </div>
        </section>

        {/* ---- 1.2 How it works ---- */}
        <section className="flex h-full w-full shrink-0 flex-col overflow-y-auto bg-cream px-6 pb-11 pt-20">
          <h2 className="font-display text-[42px] font-bold leading-none text-ink">
            {dict.welcome.howTitle1}
            <br />
            {dict.welcome.howTitle2}
          </h2>

          <div className={`mt-7 flex flex-col gap-3.5 ${page === 1 ? 'stagger' : ''}`}>
            <div className="flex items-start gap-4 rounded-[20px] border border-line bg-card p-5">
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-moss text-forest">
                <IconPin size={22} />
              </div>
              <div>
                <div className="font-display text-[21px] font-bold tracking-[0.02em] text-ink">
                  {dict.welcome.how1Title}
                </div>
                <p className="mt-1 text-[13.5px] leading-normal text-muted-foreground">{dict.welcome.how1Body}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-[20px] border border-line bg-card p-5">
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-water-tint text-water">
                <IconDrop size={22} />
              </div>
              <div>
                <div className="font-display text-[21px] font-bold tracking-[0.02em] text-ink">
                  {dict.welcome.how2Title}
                </div>
                <p className="mt-1 text-[13.5px] leading-normal text-muted-foreground">{dict.welcome.how2Body}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-[20px] border border-line bg-card p-5">
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-gold-tint text-gold">
                <IconStar size={22} />
              </div>
              <div>
                <div className="font-display text-[21px] font-bold tracking-[0.02em] text-ink">
                  {dict.welcome.how3Title}
                </div>
                <p className="mt-1 text-[13.5px] leading-normal text-muted-foreground">{dict.welcome.how3Body}</p>
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-col items-center gap-5 pt-8">
            <div className="flex gap-[7px]">
              <button
                type="button"
                aria-label="1"
                onClick={() => setPage(0)}
                className="h-[7px] w-[7px] rounded-full bg-[#D8D2C2]"
              />
              <span className="h-[7px] w-[22px] rounded-full bg-forest" />
            </div>
            <Link
              href={`/${locale}/signup`}
              className="w-full rounded-full bg-forest py-[17px] text-center text-[16px] font-semibold text-cream transition active:scale-[0.985]"
            >
              {dict.welcome.createAccount}
            </Link>
            <Link href={`/${locale}/login`} className="text-[14px] text-muted-foreground">
              {dict.welcome.haveAccount}{' '}
              <span className="font-bold text-forest">{dict.auth.signInInstead}</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
