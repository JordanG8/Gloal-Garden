import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-helpers';
import { getPostDetail } from '@/lib/social-data';
import { getDict, fill, isLocale, type Locale } from '@/i18n';
import { timeAgo } from '@/lib/format';
import { Avatar } from '@/components/avatar';
import { VoteButtons } from '@/components/community/vote-buttons';
import { CommentThread } from '@/components/community/comment-thread';
import { IconBack } from '@/components/icons';

async function PostContent({
  postId,
  slug,
  locale,
}: {
  postId: number;
  slug: string;
  locale: Locale;
}) {
  const dict = getDict(locale);
  const user = await getSessionUser();
  const detail = await getPostDetail(postId, user?.id ?? null);
  if (!detail) notFound();

  const { post, comments } = detail;
  const kindLabel = dict.community.kinds[post.kind] ?? dict.community.kinds.discussion;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/${locale}/z/${slug}`}
        className="flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-bark transition hover:text-ink"
      >
        <IconBack size={14} />
        {post.zoneName}
      </Link>

      <article className="flex gap-3">
        <VoteButtons target="post" id={post.id} score={post.score} myVote={post.myVote} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
            <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold text-soil">
              {kindLabel}
            </span>
            <Avatar name={post.authorName} id={post.authorId} src={post.authorAvatar} size={16} />
            <Link
              href={`/${locale}/users/${post.authorId}`}
              className="truncate font-semibold text-bark transition hover:text-ink"
            >
              {post.authorName}
            </Link>
            <span aria-hidden>·</span>
            <span>{timeAgo(post.createdAt, locale)}</span>
          </div>

          <h1 className="font-display text-[26px] font-bold uppercase leading-tight text-ink">
            {post.title}
          </h1>

          {post.body && (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{post.body}</p>
          )}

          {post.photoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={post.photoUrl} alt="" className="w-full rounded-2xl object-cover" />
          )}

          {post.plantId && (
            <Link
              href={`/${locale}/plants/${post.plantId}`}
              className="w-fit rounded-full border border-line bg-card px-3.5 py-1.5 text-[12px] font-semibold text-ink transition hover:border-bark"
            >
              🌱 {dict.map.fullPlantPage}
            </Link>
          )}
        </div>
      </article>

      <h2 className="microlabel text-bark">
        {post.commentCount === 1
          ? dict.community.oneComment
          : fill(dict.community.comments, { n: post.commentCount })}
      </h2>

      <CommentThread postId={post.id} comments={comments} canReply={!!user} />
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-8 w-full" />
      <div className="skeleton h-24 w-full rounded-2xl" />
      <div className="skeleton h-16 w-full rounded-2xl" />
    </div>
  );
}

async function ParamsGate({
  params,
}: {
  params: Promise<{ slug: string; id: string; locale: string }>;
}) {
  const { slug, id, locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const postId = Number.parseInt(id, 10);
  if (!Number.isFinite(postId)) notFound();
  return <PostContent postId={postId} slug={slug} locale={locale} />;
}

export default function PostPage({
  params,
}: {
  params: Promise<{ slug: string; id: string; locale: string }>;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[520px] bg-cream px-5 pb-32 pt-[max(env(safe-area-inset-top),56px)] shadow-[0_0_60px_rgba(32,37,28,0.08)]">
        <Suspense fallback={<PostSkeleton />}>
          <ParamsGate params={params} />
        </Suspense>
      </div>
    </div>
  );
}
