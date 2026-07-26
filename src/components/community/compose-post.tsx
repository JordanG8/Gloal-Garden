'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { createPost } from '@/lib/social-actions';
import { actionMsg } from '@/lib/msg';
import { POST_KINDS, MAX_POST_TITLE, MAX_POST_BODY, type PostKind } from '@/lib/social-kinds';
import PhotoInput from '@/components/photo-input';
import { IconBack } from '@/components/icons';

export function ComposePost({
  zone,
  at,
}: {
  zone: { id: number; name: string } | null;
  at: { lat: number; lng: number };
}) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<PostKind>('discussion');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) {
      setError(actionMsg('error_post_title', dict) ?? '');
      return;
    }
    setError('');
    startTransition(async () => {
      const res = await createPost({
        title,
        body,
        kind,
        photoUrl: photoUrl || undefined,
        // Zone if we resolved one server-side, otherwise let the action derive
        // it from the point — which lazily creates a grid cell if nothing
        // seeded covers it, so a post is never homeless.
        zoneId: zone?.id,
        lat: at.lat,
        lng: at.lng,
      });
      if (res.ok && res.zoneSlug && res.postId) {
        router.push(`/${locale}/z/${res.zoneSlug}/post/${res.postId}`);
        router.refresh();
      } else if (!res.ok) {
        setError(actionMsg(res.error, dict) ?? dict.common.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={dict.common.back}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          <IconBack size={16} />
        </button>
        <h1 className="font-display text-[22px] font-bold uppercase text-ink">
          {dict.community.compose}
        </h1>
        <span className="w-9" />
      </div>

      {zone && (
        <p className="text-[12px] text-muted-foreground">
          {dict.community.postIn} <strong className="text-ink">{zone.name}</strong>
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="microlabel mb-1 text-bark">{dict.community.postKind}</legend>
        <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {POST_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              aria-pressed={kind === option}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap transition ${
                kind === option ? 'bg-ink text-cream' : 'bg-card text-ink hover:bg-chip'
              }`}
            >
              {dict.community.kinds[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
        <span className="microlabel text-bark">{dict.community.postTitle}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_POST_TITLE}
          placeholder={dict.community.postTitlePlaceholder}
          className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
        <span className="microlabel text-bark">{dict.community.postBody}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_POST_BODY}
          rows={5}
          className="w-full resize-none bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      <PhotoInput name="photo" label={dict.care.attachPhoto} height={104} onChange={setPhotoUrl} />

      {error && <p className="text-[12.5px] font-semibold text-rust">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-full bg-forest px-8 py-3.5 text-[15px] font-semibold text-cream transition active:scale-95 disabled:opacity-50"
      >
        {pending ? dict.community.publishing : dict.community.publish}
      </button>
    </div>
  );
}
