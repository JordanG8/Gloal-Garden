'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/provider';
import { signOutAction } from '@/lib/auth-actions';
import { LangToggle } from '@/components/auth/welcome-pager';
import { IconForward, IconMail } from '@/components/icons';

export function MeActions({ verificationRequired }: { verificationRequired: boolean }) {
  const { dict, locale } = useI18n();

  return (
    <div className="mt-2 flex flex-col gap-3">
      <h2 className="microlabel text-bark">{dict.profile.settings}</h2>

      {verificationRequired && (
        <Link
          href={`/${locale}/verify-email`}
          className="flex items-center gap-2.5 rounded-2xl border border-gold-line bg-gold-tint px-4 py-3"
        >
          <IconMail size={16} className="shrink-0 text-gold-deep" />
          <span className="flex-1 text-[12.5px] font-semibold text-gold-ink">{dict.auth.verifyBanner}</span>
          <IconForward size={13} className="text-gold-deep" />
        </Link>
      )}

      <Link
        href={`/${locale}/me/edit`}
        className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3.5 text-[14px] font-semibold text-ink transition hover:border-bark"
      >
        {dict.profile.editProfile}
        <IconForward size={14} className="text-faint" />
      </Link>

      <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-2.5">
        <span className="text-[14px] font-semibold text-ink">{dict.profile.language}</span>
        <LangToggle />
      </div>

      <form action={signOutAction.bind(null, locale)}>
        <button
          type="submit"
          className="w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-start text-[14px] font-semibold text-rust transition hover:border-rust"
        >
          {dict.auth.signOut}
        </button>
      </form>
    </div>
  );
}
