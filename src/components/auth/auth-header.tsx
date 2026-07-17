import Link from 'next/link';
import { Logo } from '@/components/logo';
import { IconBack } from '@/components/icons';

/** Shared top of every auth screen: logo, oversized condensed title, sub. */
export function AuthHeader({
  locale,
  appName,
  title1,
  title2,
  sub,
  backHref,
}: {
  locale: string;
  appName: string;
  title1: string;
  title2?: string;
  sub?: string;
  backHref?: string;
}) {
  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between">
        <Link href={`/${locale}/welcome`} aria-label={appName}>
          <Logo name={appName} />
        </Link>
        {backHref && (
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:bg-chip"
            aria-label="back"
          >
            <IconBack size={16} />
          </Link>
        )}
      </div>
      <h1 className="mt-6 font-display text-[50px] font-bold leading-[0.98] text-ink">
        {title1}
        {title2 ? (
          <>
            <br />
            {title2}
          </>
        ) : null}
        <span className="text-gold">.</span>
      </h1>
      {sub && <p className="mt-2.5 text-[14px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
