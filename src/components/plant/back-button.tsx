'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { IconBack } from '@/components/icons';

export function BackButton({
  locale,
  tone = 'hero',
  inline = false,
}: {
  locale: string;
  tone?: 'hero' | 'page';
  inline?: boolean;
}) {
  const router = useRouter();
  const { dict } = useI18n();
  const toneCls =
    tone === 'hero'
      ? 'bg-cream/20 text-cream backdrop-blur-md hover:bg-cream/30'
      : 'border border-line bg-card text-ink hover:bg-chip';
  const positionCls = inline ? '' : 'absolute start-4 top-[max(env(safe-area-inset-top),20px)] z-10';
  return (
    <button
      type="button"
      aria-label={dict.common.back}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(`/${locale}`);
      }}
      className={`${positionCls} flex h-[38px] w-[38px] items-center justify-center rounded-full transition active:scale-95 ${toneCls}`}
    >
      <IconBack size={16} />
    </button>
  );
}
