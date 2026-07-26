import Link from 'next/link';
import { fill, type Dictionary, type Locale } from '@/i18n';
import type { PostSummary } from '@/lib/social-data';
import { timeAgo } from '@/lib/format';
import { Avatar } from '@/components/avatar';
import { VoteButtons } from './vote-buttons';

/** Colour per post kind — free harvest is gold, because it's the good one. */
const KIND_CLASS: Record<string, string> = {
  harvest_share: 'bg-gold-tint text-gold-deep',
  alert: 'bg-rust/10 text-rust',
  question: 'bg-moss text-forest',
  trade: 'bg-chip text-soil',
  event: 'bg-moss text-forest',
  photo: 'bg-chip text-soil',
  discussion: 'bg-chip text-soil',
};

export function PostCard({
  post,
  locale,
  dict,
  showZone = true,
}: {
  post: PostSummary;
  locale: Locale;
  dict: Dictionary;
  showZone?: boolean;
}) {
  const href = `/${locale}/z/${post.zoneSlug}/post/${post.id}`;
  const kindLabel = dict.community.kinds[post.kind] ?? dict.community.kinds.discussion;

  return (
    <article className="flex gap-3 rounded-2xl border border-line bg-card p-3.5 transition hover:border-bark">
      <VoteButtons target="post" id={post.id} score={post.score} myVote={post.myVote} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_CLASS[post.kind] ?? KIND_CLASS.discussion}`}>
            {kindLabel}
          </span>
          {showZone && (
            <Link
              href={`/${locale}/z/${post.zoneSlug}`}
              className="font-semibold text-bark transition hover:text-ink"
            >
              {post.zoneName}
            </Link>
          )}
          <span aria-hidden>·</span>
          <Avatar name={post.authorName} id={post.authorId} src={post.authorAvatar} size={16} />
          <span className="truncate">{post.authorName}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(post.createdAt, locale)}</span>
        </div>

        <Link href={href} className="flex flex-col gap-1">
          <h3 className="font-display text-[19px] font-bold uppercase leading-tight text-ink">
            {post.title}
          </h3>
          {post.body && (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
              {post.body}
            </p>
          )}
        </Link>

        {post.photoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.photoUrl}
            alt=""
            className="mt-0.5 max-h-56 w-full rounded-xl object-cover"
          />
        )}

        <Link
          href={href}
          className="w-fit text-[12px] font-semibold text-bark transition hover:text-ink"
        >
          {post.commentCount === 1
            ? dict.community.oneComment
            : fill(dict.community.comments, { n: post.commentCount })}
        </Link>
      </div>
    </article>
  );
}
