'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { updateProfileAction, type ProfileFormState } from '@/lib/profile-actions';
import { SubmitButton, FormNote } from '@/components/auth/bits';
import PhotoInput from '@/components/photo-input';

const IDLE: ProfileFormState = { status: 'idle', message: '' };

export function ProfileEditForm({
  initial,
}: {
  initial: { displayName: string; bio: string; location: string; avatar: string };
}) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState(updateProfileAction, IDLE);

  useEffect(() => {
    if (state.status === 'success') {
      router.push(`/${locale}/me`);
      router.refresh();
    }
  }, [state.status, router, locale]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <PhotoInput name="avatar" label={dict.profile.photo} height={104} round initialUrl={initial.avatar} />
        <span className="microlabel text-bark">{dict.profile.photo}</span>
      </div>

      <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
        <span className="microlabel text-bark">{dict.profile.name}</span>
        <input
          name="displayName"
          defaultValue={initial.displayName}
          required
          minLength={2}
          maxLength={60}
          className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
        <span className="microlabel text-bark">{dict.profile.bio}</span>
        <textarea
          name="bio"
          defaultValue={initial.bio}
          placeholder={dict.profile.bioPlaceholder}
          rows={3}
          maxLength={240}
          className="w-full resize-none bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
        <span className="microlabel text-bark">{dict.profile.location}</span>
        <input
          name="location"
          defaultValue={initial.location}
          placeholder={dict.profile.locationPlaceholder}
          maxLength={80}
          className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      {state.status === 'error' && <FormNote code={state.message} tone="error" />}
      <SubmitButton label={dict.profile.save} pendingLabel={dict.profile.saving} />
    </form>
  );
}
