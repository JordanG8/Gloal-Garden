'use server';

import { db, runBatch, type BatchItem } from '@/db';
import { gardens, karmaEvents, observations, plants, species, users } from '@/db/schema';
import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { emailVerificationBlocker, requireUserId } from './auth-helpers';
import { nextWaterDueAt, needsWater } from './care-schedule';
import { computeStatus } from './plant-status';
import { bulkWaterMultiplier, computeAward, dailyCapFor } from './karma';
import type { ActionResult } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** One tap should never fan out further than this. */
const MAX_BATCH = 200;

/**
 * Water everything in a garden, or everything on one bed, in a single action.
 *
 * Mandatory once a garden has a hundred plants: nobody is going to tap through
 * a hundred care flows, and without this the honest thing to do would be to
 * stop logging entirely — which loses the data the whole app is built on.
 *
 * The interesting part is the karma. `computeAward` applies the daily cap from
 * `ctx.earnedLast24h`, which its callers read once before acting. In a loop
 * that means every iteration sees the *pre-batch* total, so watering thirty
 * plants sails straight through a cap of 150. This threads a running total
 * forward, so the cap means what it says.
 */
export async function waterBatch(input: {
  gardenId: number;
  /** Restrict to one bed. Omit to water everything due in the garden. */
  bedLabel?: string | null;
  /** Only water what's actually due, which is almost always what's wanted. */
  onlyDue?: boolean;
}): Promise<ActionResult & { watered?: number; skipped?: number }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };
  const verificationError = await emailVerificationBlocker(userId);
  if (verificationError) return { ok: false, error: verificationError };

  const now = new Date();

  try {
    const [garden] = await db
      .select({ id: gardens.id })
      .from(gardens)
      .where(eq(gardens.id, input.gardenId))
      .limit(1);
    if (!garden) return { ok: false, error: 'error_not_found' };

    const [actor] = await db
      .select({ karma: users.karma, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!actor) return { ok: false, error: 'error_signed_out' };

    const [earned] = await db
      .select({ total: sql<number>`coalesce(sum(${karmaEvents.points}), 0)::int` })
      .from(karmaEvents)
      .where(
        and(
          eq(karmaEvents.userId, userId),
          gt(karmaEvents.createdAt, new Date(now.getTime() - DAY_MS))
        )
      );

    const rows = await db
      .select({ plant: plants, species: species })
      .from(plants)
      .innerJoin(species, eq(plants.speciesId, species.id))
      .where(
        and(
          eq(plants.gardenId, input.gardenId),
          ne(plants.status, 'removed'),
          // An observe_only plant in the garden is someone else's tree that
          // happens to stand inside the boundary; it is never part of a chore.
          ne(plants.careMode, 'observe_only'),
          input.bedLabel === undefined
            ? undefined
            : input.bedLabel === null
              ? isNull(plants.bedLabel)
              : eq(plants.bedLabel, input.bedLabel)
        )
      )
      .limit(MAX_BATCH);

    const targets = rows.filter(
      ({ plant, species: sp }) => !input.onlyDue || needsWater(plant, sp, now)
    );
    if (targets.length === 0) {
      return { ok: true, watered: 0, skipped: rows.length, note: 'note_nothing_due' };
    }

    const cap = dailyCapFor(actor.createdAt, actor.karma, now);
    let runningEarned = earned?.total ?? 0;
    let totalAwarded = 0;
    const statements: BatchItem[] = [];

    for (const [index, { plant, species: sp }] of targets.entries()) {
      const award = computeAward({
        actorId: userId,
        actionType: 'water',
        now,
        plant: {
          plantedBy: plant.plantedBy,
          plantedAt: plant.plantedAt,
          lastWateredAt: plant.lastWateredAt,
          status: computeStatus(plant, sp, now),
          careMode: plant.careMode,
          waterIntervalSummerDays: plant.waterIntervalSummerDays,
          waterIntervalWinterDays: plant.waterIntervalWinterDays,
        },
        species: sp,
        plantVerified: plant.photoCount > 0,
        hasPhoto: false,
        lastEarnedSameKindByUserAt: null,
        lastEarnedSameKindOnPlantAt: null,
        latestAlert: null,
        // The running total, not the pre-batch one. This is the fix.
        earnedLast24h: runningEarned,
        accountCreatedAt: actor.createdAt,
        currentKarma: actor.karma,
      });

      const tapered = Math.round(award.points * bulkWaterMultiplier(index));
      // Belt and braces: even with the taper, never step over the cap.
      const points = Math.max(0, Math.min(tapered, cap - runningEarned));
      runningEarned += points;
      totalAwarded += points;

      statements.push(
        db.insert(observations).values({
          plantId: plant.id,
          userId,
          type: 'water',
          caption: null,
        }),
        db
          .update(plants)
          .set({
            lastWateredAt: now,
            lastCheckedAt: now,
            waterDueAt: nextWaterDueAt({ ...plant, lastWateredAt: now }, sp, now),
          })
          .where(eq(plants.id, plant.id)),
        db.insert(karmaEvents).values({
          userId,
          plantId: plant.id,
          kind: award.kind,
          points,
        })
      );
    }

    statements.push(
      db.update(users).set({ karma: sql`${users.karma} + ${totalAwarded}` }).where(eq(users.id, userId))
    );

    await runBatch(statements);

    revalidatePath('/[locale]/gardens/[slug]', 'page');
    revalidatePath('/[locale]', 'layout');
    return {
      ok: true,
      watered: targets.length,
      skipped: rows.length - targets.length,
      pointsAwarded: totalAwarded,
      note: runningEarned >= cap ? 'note_daily_cap' : undefined,
    };
  } catch (error) {
    console.error('waterBatch failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}
