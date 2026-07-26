'use client';

import { useOptimistic, useTransition } from 'react';
import { useI18n } from '@/i18n/provider';
import { voteOnComment, voteOnPost } from '@/lib/social-actions';

/**
 * Up/down voting.
 *
 * Optimistic on purpose: the score is maintained by a database trigger and the
 * page re-reads on the next navigation, so waiting for a round trip before
 * moving the arrow would make voting feel broken. Clicking the same arrow twice
 * clears the vote, matching what everyone expects from this control.
 */
export function VoteButtons({
  target,
  id,
  score,
  myVote,
  compact = false,
}: {
  target: 'post' | 'comment';
  id: number;
  score: number;
  myVote: number;
  compact?: boolean;
}) {
  const { dict } = useI18n();
  const [, startTransition] = useTransition();
  const [state, setState] = useOptimistic(
    { score, myVote },
    (_current, next: { score: number; myVote: number }) => next
  );

  function cast(value: number) {
    const nextVote = state.myVote === value ? 0 : value;
    // The score moves by the difference between the old and new vote, which is
    // exactly what the trigger will compute server-side.
    const nextScore = score - myVote + nextVote;

    startTransition(async () => {
      setState({ score: nextScore, myVote: nextVote });
      if (target === 'post') await voteOnPost({ postId: id, value: nextVote });
      else await voteOnComment({ commentId: id, value: nextVote });
    });
  }

  const size = compact ? 'text-[15px]' : 'text-[17px]';

  return (
    <div
      className={`flex shrink-0 items-center ${compact ? 'gap-1' : 'flex-col gap-0.5'}`}
    >
      <button
        type="button"
        onClick={() => cast(1)}
        aria-label={dict.community.upvote}
        aria-pressed={state.myVote === 1}
        className={`${size} leading-none transition active:scale-90 ${
          state.myVote === 1 ? 'text-leaf' : 'text-faint hover:text-bark'
        }`}
      >
        ▲
      </button>
      <span
        className={`stat-number tabular-nums ${compact ? 'text-[12px]' : 'text-[13px]'} ${
          state.myVote === 1 ? 'text-leaf' : state.myVote === -1 ? 'text-rust' : 'text-ink'
        }`}
      >
        {state.score}
      </span>
      <button
        type="button"
        onClick={() => cast(-1)}
        aria-label={dict.community.downvote}
        aria-pressed={state.myVote === -1}
        className={`${size} leading-none transition active:scale-90 ${
          state.myVote === -1 ? 'text-rust' : 'text-faint hover:text-bark'
        }`}
      >
        ▼
      </button>
    </div>
  );
}
