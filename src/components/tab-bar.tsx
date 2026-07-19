'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { IconMap, IconLeafPair, IconPlus, IconTrophy, IconUser } from './icons';

/**
 * Bottom navigation per the design: four labeled tabs around a raised
 * forest-green “add a plant” FAB.
 */
export function TabBar() {
  const { dict, locale } = useI18n();
  const pathname = usePathname();

  const base = `/${locale}`;
  const tabs = [
    { href: base, label: dict.tabs.map, icon: IconMap, exact: true },
    { href: `${base}/garden`, label: dict.tabs.garden, icon: IconLeafPair, exact: false },
    null, // FAB slot
    { href: `${base}/ranks`, label: dict.tabs.ranks, icon: IconTrophy, exact: false },
    { href: `${base}/me`, label: dict.tabs.you, icon: IconUser, exact: false },
  ] as const;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="pointer-events-auto mx-auto w-full max-w-[520px] border-t border-line bg-white/95 px-6 pb-[max(env(safe-area-inset-bottom),14px)] pt-2.5 backdrop-blur-xl">
        <div className="flex items-end justify-between">
          {tabs.map((tab) => {
            if (!tab) {
              return (
                <Link
                  key="fab"
                  href={`${base}/add`}
                  aria-label={dict.tabs.add}
                  className="-mt-9 flex h-[58px] w-[58px] items-center justify-center rounded-full border-4 border-cream bg-forest text-cream shadow-[0_8px_20px_rgba(23,64,43,0.4)] transition hover:bg-pine active:scale-95"
                >
                  <IconPlus size={24} />
                </Link>
              );
            }
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex w-14 flex-col items-center gap-1 pb-0.5 transition-colors ${
                  active ? 'text-forest' : 'text-faint hover:text-bark'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={23} />
                <span className="text-[9.5px] font-bold uppercase tracking-[0.08em]">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
