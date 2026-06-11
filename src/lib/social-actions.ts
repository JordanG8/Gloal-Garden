'use server';

import { auth } from '@/auth';
import { db } from '@/db';
import { adoptions, follows, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from './types';

async function requireUserId(): Promise<number | null> {
  const session = await auth();
  const id = session?.user?.id ? parseInt(session.user.id, 10) : NaN;
  return Number.isFinite(id) ? id : null;
}

export async function toggleFollow(targetId: number): Promise<ActionResult & { following?: boolean }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'Sign in to follow gardeners.' };
  if (userId === targetId) return { ok: false, error: 'You cannot follow yourself.' };

  try {
    const existing = await db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(and(eq(follows.followerId, userId), eq(follows.followingId, targetId)))
      .limit(1);

    let following: boolean;
    if (existing.length > 0) {
      await db.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.followingId, targetId)));
      following = false;
    } else {
      await db.insert(follows).values({ followerId: userId, followingId: targetId }).onConflictDoNothing();
      following = true;
    }

    revalidatePath(`/gardeners/${targetId}`);
    revalidatePath('/feed');
    return { ok: true, following };
  } catch (error) {
    console.error('toggleFollow failed:', error);
    return { ok: false, error: 'Could not update follow. Please try again.' };
  }
}

export async function toggleAdoption(plantId: number): Promise<ActionResult & { adopted?: boolean }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'Sign in to adopt plants.' };

  try {
    const existing = await db
      .select({ userId: adoptions.userId })
      .from(adoptions)
      .where(and(eq(adoptions.userId, userId), eq(adoptions.plantId, plantId)))
      .limit(1);

    let adopted: boolean;
    if (existing.length > 0) {
      await db.delete(adoptions).where(and(eq(adoptions.userId, userId), eq(adoptions.plantId, plantId)));
      adopted = false;
    } else {
      await db.insert(adoptions).values({ userId, plantId }).onConflictDoNothing();
      adopted = true;
    }

    revalidatePath(`/plants/${plantId}`);
    return { ok: true, adopted };
  } catch (error) {
    console.error('toggleAdoption failed:', error);
    return { ok: false, error: 'Could not update adoption. Please try again.' };
  }
}

export async function updateProfile(input: {
  displayName: string;
  bio: string;
  location: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'Sign in to edit your profile.' };

  const displayName = input.displayName.trim().slice(0, 50);
  if (displayName.length < 2) return { ok: false, error: 'Display name must be at least 2 characters.' };

  try {
    await db
      .update(users)
      .set({
        displayName,
        bio: input.bio.trim().slice(0, 280) || null,
        location: input.location.trim().slice(0, 80) || null,
      })
      .where(eq(users.id, userId));

    revalidatePath(`/gardeners/${userId}`);
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('updateProfile failed:', error);
    return { ok: false, error: 'Could not save your profile. Please try again.' };
  }
}
