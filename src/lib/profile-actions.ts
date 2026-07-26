'use server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireUserId } from './auth-helpers';
import { isValidPhotoUrl } from './photo-url';
import { LOCALE_COOKIE, isLocale } from '@/i18n/config';

export interface ProfileFormState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

export async function updateProfileAction(
  _prev: ProfileFormState | undefined,
  formData: FormData
): Promise<ProfileFormState> {
  const userId = await requireUserId();
  if (!userId) return { status: 'error', message: 'Not signed in.' };

  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 60);
  const bio = String(formData.get('bio') ?? '').trim().slice(0, 240);
  const location = String(formData.get('location') ?? '').trim().slice(0, 80);
  const avatar = String(formData.get('avatar') ?? '').trim();

  if (displayName.length < 2) {
    return { status: 'error', message: 'name' };
  }
  if (!isValidPhotoUrl(avatar)) {
    return { status: 'error', message: 'photo' };
  }

  try {
    await db
      .update(users)
      .set({
        displayName,
        bio: bio || null,
        location: location || null,
        avatar: avatar || null,
      })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error('updateProfileAction failed:', error);
    return { status: 'error', message: 'save' };
  }

  revalidatePath('/[locale]', 'layout');
  return { status: 'success', message: '' };
}

/** Language switch: persists the preference and the UI re-renders via URL. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
}
