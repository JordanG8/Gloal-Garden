'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/provider';
import type { CommentNode } from '@/lib/social-data';
import { addComment } from '@/lib/social-actions';
import { actionMsg } from '@/lib/msg';
import { MAX_COMMENT_BODY } from '@/lib/social-kinds';
import { timeAgo } from '@/lib/format';
import { Avatar } from '@/components/avatar';
import { VoteButtons } from './vote-buttons';

/**
 * A flat, pre-ordered comment list rendered as a thread.
 *
 * The server already returns rows in (path, created_at, id) order, which is
 * correct tree order — so this walks the list once and indents by depth rather
 * than building a nested structure. Indentation stops at three levels: the
 * shell is 520px wide and anything deeper has no room to say anything.
 */
/**
 * Declared at module scope, not inside CommentThread. A component created
 * during render is a new type on every render, so React unmounts and remounts
 * it — which for a textarea means the reply you were typing disappears the
 * moment anything else in the thread changes.
 */
function Composer({
  parentId,
  body,
  setBody,
  error,
  pending,
  onSubmit,
  onCancel,
}: {
  parentId: number | null;
  body: string;
  setBody: (value: string) => void;
  error: string;
  pending: boolean;
  onSubmit: (parentId: number | null) => void;
  onCancel: () => void;
}) {
  const { dict } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_COMMENT_BODY}
        rows={parentId === null ? 3 : 2}
        placeholder={dict.community.replyPlaceholder}
        className="w-full resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none transition-all placeholder:text-faint focus:border-forest focus:shadow-[0_0_0_3px_rgba(23,64,43,.08)]"
      />
      {error && <p className="text-[12px] font-semibold text-rust">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSubmit(parentId)}
          disabled={pending || !body.trim()}
          className="rounded-full bg-forest px-5 py-2 text-[13px] font-semibold text-cream transition disabled:opacity-50"
        >
          {pending ? dict.community.sending : dict.community.send}
        </button>
        {parentId !== null && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line px-5 py-2 text-[13px] font-semibold text-ink"
          >
            {dict.common.cancel}
          </button>
        )}
      </div>
    </div>
  );
}

export function CommentThread({
  postId,
  comments,
  canReply,
}: {
  postId: number;
  comments: CommentNode[];
  canReply: boolean;
}) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function submit(parentId: number | null) {
    if (!body.trim()) return;
    setError('');
    startTransition(async () => {
      const res = await addComment({ postId, body, parentId: parentId ?? undefined });
      if (res.ok) {
        setBody('');
        setReplyTo(null);
        router.refresh();
      } else {
        setError(actionMsg(res.error, dict) ?? dict.common.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      {canReply && replyTo === null && (
        <Composer
          parentId={null}
          body={body}
          setBody={setBody}
          error={error}
          pending={pending}
          onSubmit={submit}
          onCancel={() => setReplyTo(null)}
        />
      )}

      {comments.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">
          {dict.community.noComments}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {comments.map((comment) => (
            <li
              key={comment.id}
              // Logical padding so the thread indents correctly in RTL too.
              style={{ paddingInlineStart: `${comment.depth * 16}px` }}
            >
              <div
                className={`flex gap-2.5 rounded-2xl border px-3 py-2.5 ${
                  comment.depth > 0 ? 'border-line/70 bg-white/50' : 'border-line bg-card'
                }`}
              >
                {!comment.deleted && (
                  <VoteButtons
                    target="comment"
                    id={comment.id}
                    score={comment.score}
                    myVote={comment.myVote}
                    compact
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-faint">
                    {!comment.deleted && (
                      <>
                        <Avatar
                          name={comment.authorName}
                          id={comment.authorId}
                          src={comment.authorAvatar}
                          size={16}
                        />
                        <Link
                          href={`/${locale}/users/${comment.authorId}`}
                          className="truncate font-semibold text-bark transition hover:text-ink"
                        >
                          {comment.authorName}
                        </Link>
                        <span aria-hidden>·</span>
                      </>
                    )}
                    <span>{timeAgo(comment.createdAt, locale)}</span>
                  </div>

                  {comment.deleted ? (
                    <p className="text-[13px] italic text-faint">{dict.community.removed}</p>
                  ) : (
                    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                      {comment.body}
                    </p>
                  )}

                  {canReply && !comment.deleted && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(comment.id);
                        setBody('');
                      }}
                      className="w-fit text-[11.5px] font-semibold text-bark transition hover:text-ink"
                    >
                      {dict.community.reply}
                    </button>
                  )}
                </div>
              </div>

              {replyTo === comment.id && (
                <div className="mt-2">
                  <Composer
                    parentId={comment.id}
                    body={body}
                    setBody={setBody}
                    error={error}
                    pending={pending}
                    onSubmit={submit}
                    onCancel={() => {
                      setReplyTo(null);
                      setBody('');
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
