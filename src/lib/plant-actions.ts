'use server';

import { auth } from '@/auth';
import { db } from '@/db';
import { observations, plants, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from './types';

async function requireUserId(): Promise<number | null> {
  const session = await auth();
  const id = session?.user?.id ? parseInt(session.user.id, 10) : NaN;
  return Number.isFinite(id) ? id : null;
}

type StatKey = 'plantsAdded' | 'photosContributed' | 'careActions' | 'harvestsLogged';

const DEFAULT_STATS = { plantsAdded: 0, photosContributed: 0, careActions: 0, harvestsLogged: 0 };

async function incrementStat(userId: number, key: StatKey) {
  const [user] = await db.select({ stats: users.stats }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;
  const stats = { ...DEFAULT_STATS, ...(user.stats ?? {}) };
  stats[key] += 1;
  await db.update(users).set({ stats }).where(eq(users.id, userId));
}

export async function createPlant(input: {
  speciesId: number;
  lat: number;
  lng: number;
  nickname: string;
  description: string;
  accessNotes: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in to add a plant.' };

  if (
    !Number.isFinite(input.lat) || !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180
  ) {
    return { ok: false, error: 'Invalid location.' };
  }
  if (!Number.isInteger(input.speciesId)) {
    return { ok: false, error: 'Please choose a species.' };
  }

  try {
    await db.insert(plants).values({
      speciesId: input.speciesId,
      lat: input.lat,
      lng: input.lng,
      plantedBy: userId,
      nickname: input.nickname.trim().slice(0, 80) || null,
      description: input.description.trim().slice(0, 500) || null,
      accessNotes: input.accessNotes.trim().slice(0, 300) || null,
      lastWateredAt: new Date(),
    });
    await incrementStat(userId, 'plantsAdded');
  } catch (error) {
    console.error('createPlant failed:', error);
    return { ok: false, error: 'Could not save the plant. Please try again.' };
  }

  revalidatePath('/');
  return { ok: true };
}

export async function logCareAction(input: {
  plantId: number;
  type: 'water' | 'photo' | 'harvest' | 'report' | 'resolve';
  caption?: string;
  photoUrl?: string;
  harvestQuantity?: string;
  diseaseTag?: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in to log care actions.' };

  const caption = input.caption?.trim().slice(0, 500) || null;

  try {
    const [plant] = await db.select().from(plants).where(eq(plants.id, input.plantId)).limit(1);
    if (!plant) return { ok: false, error: 'Plant not found.' };

    switch (input.type) {
      case 'water':
        await db.insert(observations).values({ plantId: plant.id, userId, type: 'water', caption });
        await db
          .update(plants)
          .set({ lastWateredAt: new Date(), lastCheckedAt: new Date() })
          .where(eq(plants.id, plant.id));
        await incrementStat(userId, 'careActions');
        break;

      case 'photo': {
        const photoUrl = input.photoUrl?.trim() || null;
        if (photoUrl && !/^https?:\/\//.test(photoUrl)) {
          return { ok: false, error: 'Photo URL must start with http:// or https://.' };
        }
        if (!photoUrl && !caption) {
          return { ok: false, error: 'Add a photo URL or a note.' };
        }
        await db.insert(observations).values({ plantId: plant.id, userId, type: 'photo', caption, photoUrl });
        await db.update(plants).set({ lastCheckedAt: new Date() }).where(eq(plants.id, plant.id));
        await incrementStat(userId, 'photosContributed');
        break;
      }

      case 'harvest':
        await db.insert(observations).values({
          plantId: plant.id,
          userId,
          type: 'harvest',
          caption,
          harvestQuantity: input.harvestQuantity?.trim().slice(0, 100) || null,
        });
        await db.update(plants).set({ lastCheckedAt: new Date() }).where(eq(plants.id, plant.id));
        await incrementStat(userId, 'harvestsLogged');
        break;

      case 'report': {
        const diseaseTag = input.diseaseTag?.trim().slice(0, 50) || null;
        if (!caption && !diseaseTag) {
          return { ok: false, error: 'Describe the issue or pick a tag.' };
        }
        await db.insert(observations).values({ plantId: plant.id, userId, type: 'alert', caption, diseaseTag });
        await db
          .update(plants)
          .set({ status: diseaseTag ? 'diseased' : 'needs_attention', lastCheckedAt: new Date() })
          .where(eq(plants.id, plant.id));
        await incrementStat(userId, 'careActions');
        break;
      }

      case 'resolve':
        await db.insert(observations).values({ plantId: plant.id, userId, type: 'resolve', caption });
        await db
          .update(plants)
          .set({ status: 'growing', lastCheckedAt: new Date() })
          .where(eq(plants.id, plant.id));
        await incrementStat(userId, 'careActions');
        break;

      default:
        return { ok: false, error: 'Unknown action.' };
    }
  } catch (error) {
    console.error('logCareAction failed:', error);
    return { ok: false, error: 'Could not save the action. Please try again.' };
  }

  revalidatePath('/');
  return { ok: true };
}
