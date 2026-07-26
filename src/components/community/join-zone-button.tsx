'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { toggleZoneMembership } from '@/lib/social-actions';

/**
 * Join/leave a community. Optimistic, because the only thing that changes is a
 * label and the server round trip is not worth a spinner.
 */
export function JoinZoneButton({
  zoneId,
  joined = false,
}: {
  zoneId: number;
  joined?: boolean;
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isJoined, setJoined] = useOptimistic(joined, (_c, next: boolean) => next);

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          setJoined(!isJoined);
          await toggleZoneMembership({ zoneId });
          router.refresh();
        })
      }
      aria-pressed={isJoined}
      className={`shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold transition active:scale-95 ${
        isJoined ? 'border border-line bg-card text-ink' : 'bg-forest text-cream'
      }`}
    >
      {isJoined ? dict.community.joined : dict.community.join}
    </button>
  );
}
