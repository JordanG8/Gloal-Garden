'use server';

import { db } from '@/db';
import { adoptions, karmaEvents, plants, species, users } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { emailVerificationBlocker, requireUserId } from './auth-helpers';
import {
  activityWindowDays,
  adoptionCapFor,
  isStewardActive,
  POINTS,
} from './karma';
import type { ActionResult } from './types';

export async function adoptPlant(plantId: number): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in to adopt a plant.' };
  const verificationError = await emailVerificationBlocker(userId);
  if (verificationError) return { ok: false, error: verificationError };

  try {
    const now = new Date();
    const [plant] = await db
      .select({ id: plants.id, plantedBy: plants.plantedBy })
      .from(plants)
      .where(eq(plants.id, plantId))
      .limit(1);
    if (!plant) return { ok: false, error: 'Plant not found.' };
    if (plant.plantedBy === userId) {
      return { ok: false, error: 'You planted this one — founders are stewards for life.' };
    }

    const [existing] = await db
      .select({ createdAt: adoptions.createdAt })
      .from(adoptions)
      .where(and(eq(adoptions.userId, userId), eq(adoptions.plantId, plantId)))
      .limit(1);
    if (existing) return { ok: false, error: 'You already steward this plant.' };

    const [user] = await db
      .select({ karma: users.karma })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { ok: false, error: 'Account not found.' };

    // The cap counts only ACTIVE stewardships — decayed adoptions don't block
    // new ones, so lapsed gardeners can always pick up a new plant.
    const cap = adoptionCapFor(user.karma);
    const rows = await db
      .select({
        adoptedAt: adoptions.createdAt,
        wateringFrequencyDays: species.wateringFrequencyDays,
        lastActionAt: sql<string | null>`(
          select max(o.created_at) from observations o
          where o.user_id = ${userId} and o.plant_id = ${adoptions.plantId}
        )`,
      })
      .from(adoptions)
      .innerJoin(plants, eq(adoptions.plantId, plants.id))
      .innerJoin(species, eq(plants.speciesId, species.id))
      .where(eq(adoptions.userId, userId));

    const activeCount = rows.filter((row) =>
      isStewardActive(
        {
          lastActionAt: row.lastActionAt ? new Date(row.lastActionAt) : null,
          adoptedAt: row.adoptedAt,
          windowDays: activityWindowDays({ wateringFrequencyDays: row.wateringFrequencyDays }),
        },
        now
      )
    ).length;

    if (activeCount >= cap) {
      return {
        ok: false,
        error: `You're already actively stewarding ${activeCount} plants — your trust level caps at ${cap}. Earn karma to raise the cap.`,
      };
    }

    // Adoption pays once per (user, plant) EVER — re-adopting after abandoning
    // earns nothing, so the adopt/abandon cycle can't be farmed.
    const [priorAdoptEvent] = await db
      .select({ id: karmaEvents.id })
      .from(karmaEvents)
      .where(
        and(
          eq(karmaEvents.userId, userId),
          eq(karmaEvents.plantId, plantId),
          eq(karmaEvents.kind, 'adopt')
        )
      )
      .limit(1);
    const points = priorAdoptEvent ? 0 : POINTS.adopt;

    const statements = [
      db.insert(adoptions).values({ userId, plantId }),
      db.insert(karmaEvents).values({ userId, plantId, kind: 'adopt', points }),
    ] as const;
    if (points > 0) {
      await db.batch([
        ...statements,
        db.update(users).set({ karma: sql`${users.karma} + ${points}` }).where(eq(users.id, userId)),
      ]);
    } else {
      await db.batch([...statements]);
    }

    revalidatePath('/');
    revalidatePath(`/plants/${plantId}`);
    return { ok: true, pointsAwarded: points };
  } catch (error) {
    console.error('adoptPlant failed:', error);
    return { ok: false, error: 'Could not adopt the plant. Please try again.' };
  }
}

export async function abandonPlant(plantId: number): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  try {
    // No karma penalty — decay (and losing the steward credit) is the penalty.
    await db
      .delete(adoptions)
      .where(and(eq(adoptions.userId, userId), eq(adoptions.plantId, plantId)));
  } catch (error) {
    console.error('abandonPlant failed:', error);
    return { ok: false, error: 'Could not update your stewardship. Please try again.' };
  }

  revalidatePath('/');
  revalidatePath(`/plants/${plantId}`);
  return { ok: true };
}
