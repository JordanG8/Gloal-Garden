'use server';

import { db } from '@/db';
import { adoptions, karmaEvents, observations, plants, species, users } from '@/db/schema';
import { and, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireUserId } from './auth-helpers';
import { computeStatus } from './plant-status';
import {
  activityWindowDays,
  canEditPlant,
  canFlipStatus,
  canResolve,
  computeAward,
  evaluateBadges,
  isStewardActive,
  plantEstablishedEligible,
  plantNewPoints,
  reportConfirmedPoints,
  KIND_TO_METRICS,
  POINTS,
  type BadgeMetric,
  type KarmaKind,
} from './karma';
import type { ActionResult } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

type BatchItem = Parameters<typeof db.batch>[0][number];

async function runBatch(statements: BatchItem[]) {
  if (statements.length === 0) return;
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
}

async function earnedInLast24h(userId: number, now: Date): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${karmaEvents.points}), 0)::int` })
    .from(karmaEvents)
    .where(and(eq(karmaEvents.userId, userId), gt(karmaEvents.createdAt, new Date(now.getTime() - DAY_MS))));
  return row?.total ?? 0;
}

async function latestEarningEventAt(
  kind: KarmaKind,
  plantId: number,
  userId?: number
): Promise<Date | null> {
  const conditions = [
    eq(karmaEvents.plantId, plantId),
    eq(karmaEvents.kind, kind),
    gt(karmaEvents.points, 0),
  ];
  if (userId !== undefined) conditions.push(eq(karmaEvents.userId, userId));
  const [row] = await db
    .select({ createdAt: karmaEvents.createdAt })
    .from(karmaEvents)
    .where(and(...conditions))
    .orderBy(desc(karmaEvents.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

async function isPlantVerified(plantId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: observations.id })
    .from(observations)
    .where(and(eq(observations.plantId, plantId), isNotNull(observations.photoUrl)))
    .limit(1);
  return !!row;
}

async function stewardStanding(
  userId: number,
  plantId: number,
  wateringFrequencyDays: number | null,
  now: Date
): Promise<{ isSteward: boolean; isActiveSteward: boolean }> {
  const [adoption] = await db
    .select({ createdAt: adoptions.createdAt })
    .from(adoptions)
    .where(and(eq(adoptions.userId, userId), eq(adoptions.plantId, plantId)))
    .limit(1);
  if (!adoption) return { isSteward: false, isActiveSteward: false };

  const [lastObs] = await db
    .select({ at: sql<string | null>`max(${observations.createdAt})` })
    .from(observations)
    .where(and(eq(observations.userId, userId), eq(observations.plantId, plantId)));

  const active = isStewardActive(
    {
      lastActionAt: lastObs?.at ? new Date(lastObs.at) : null,
      adoptedAt: adoption.createdAt,
      windowDays: activityWindowDays({ wateringFrequencyDays }),
    },
    now
  );
  return { isSteward: true, isActiveSteward: active };
}

/**
 * Evaluate only the badges whose metrics could have changed, award any new
 * ones, and return their display names for the toast.
 */
async function awardBadges(userId: number, kinds: KarmaKind[]): Promise<string[]> {
  const needed = new Set<BadgeMetric>();
  for (const kind of kinds) {
    for (const metric of KIND_TO_METRICS[kind] ?? []) needed.add(metric);
  }
  if (needed.size === 0) return [];

  const [user] = await db
    .select({ karma: users.karma, badges: users.badges })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return [];
  const currentBadges = user.badges ?? [];

  const countEvents = async (where: ReturnType<typeof and>) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(karmaEvents)
      .where(where);
    return row?.n ?? 0;
  };

  const metrics: Partial<Record<BadgeMetric, number>> = {};
  for (const metric of needed) {
    switch (metric) {
      case 'karma':
        metrics.karma = user.karma;
        break;
      case 'plantsFounded': {
        const [row] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(plants)
          .where(eq(plants.plantedBy, userId));
        metrics.plantsFounded = row?.n ?? 0;
        break;
      }
      case 'earningHarvests':
        metrics.earningHarvests = await countEvents(
          and(eq(karmaEvents.userId, userId), eq(karmaEvents.kind, 'harvest'), gt(karmaEvents.points, 0))
        );
        break;
      case 'verifiedHarvests': {
        const [row] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(observations)
          .where(
            and(
              eq(observations.userId, userId),
              eq(observations.type, 'harvest'),
              isNotNull(observations.photoUrl)
            )
          );
        metrics.verifiedHarvests = row?.n ?? 0;
        break;
      }
      case 'earningWaterDue':
        metrics.earningWaterDue = await countEvents(
          and(eq(karmaEvents.userId, userId), eq(karmaEvents.kind, 'water_due'), gt(karmaEvents.points, 0))
        );
        break;
      case 'rescueBonuses':
        metrics.rescueBonuses = await countEvents(
          and(eq(karmaEvents.userId, userId), eq(karmaEvents.kind, 'rescue_bonus'))
        );
        break;
      case 'goodNeighborEvents': {
        const [row] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(karmaEvents)
          .innerJoin(plants, eq(karmaEvents.plantId, plants.id))
          .where(
            and(
              eq(karmaEvents.userId, userId),
              gt(karmaEvents.points, 0),
              sql`${karmaEvents.kind} in ('water_due', 'photo', 'harvest', 'resolve')`,
              sql`${plants.plantedBy} <> ${userId}`
            )
          );
        metrics.goodNeighborEvents = row?.n ?? 0;
        break;
      }
      case 'adopts':
        metrics.adopts = await countEvents(
          and(eq(karmaEvents.userId, userId), eq(karmaEvents.kind, 'adopt'))
        );
        break;
      case 'reportsConfirmed':
        metrics.reportsConfirmed = await countEvents(
          and(eq(karmaEvents.userId, userId), eq(karmaEvents.kind, 'report_confirmed'))
        );
        break;
      case 'earningPhotos':
        metrics.earningPhotos = await countEvents(
          and(eq(karmaEvents.userId, userId), eq(karmaEvents.kind, 'photo'), gt(karmaEvents.points, 0))
        );
        break;
      case 'firstHarvestBonuses':
        metrics.firstHarvestBonuses = await countEvents(
          and(eq(karmaEvents.userId, userId), eq(karmaEvents.kind, 'plant_first_harvest'))
        );
        break;
    }
  }

  const earned = evaluateBadges(metrics, currentBadges);
  if (earned.length === 0) return [];
  await db
    .update(users)
    .set({ badges: [...currentBadges, ...earned.map((b) => b.id)] })
    .where(eq(users.id, userId));
  return earned.map((b) => `${b.name} ${b.emoji}`);
}

/**
 * One-time founder bonuses. The partial unique index on (plant_id, kind) makes
 * the insert race-proof; karma is only incremented when the insert actually
 * landed, so a lost race can't double-pay.
 */
async function payFounderBonus(
  kind: 'plant_established' | 'plant_first_harvest',
  plantId: number,
  founderId: number,
  points: number
): Promise<boolean> {
  const inserted = await db
    .insert(karmaEvents)
    .values({ userId: founderId, plantId, kind, points })
    .onConflictDoNothing()
    .returning({ id: karmaEvents.id });
  if (inserted.length === 0) return false;
  await db
    .update(users)
    .set({ karma: sql`${users.karma} + ${points}` })
    .where(eq(users.id, founderId));
  return true;
}

async function maybePayEstablishedBonus(
  plant: { id: number; plantedBy: number; plantedAt: Date },
  verified: boolean,
  now: Date
) {
  const ageDays = (now.getTime() - plant.plantedAt.getTime()) / DAY_MS;
  if (!verified || ageDays < 30) return;

  const [existing] = await db
    .select({ id: karmaEvents.id })
    .from(karmaEvents)
    .where(and(eq(karmaEvents.plantId, plant.id), eq(karmaEvents.kind, 'plant_established')))
    .limit(1);
  if (existing) return;

  const [careStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      carers: sql<number>`count(distinct ${observations.userId})::int`,
      nonFounder: sql<number>`count(*) filter (where ${observations.userId} <> ${plant.plantedBy})::int`,
    })
    .from(observations)
    .where(eq(observations.plantId, plant.id));

  const eligible = plantEstablishedEligible({
    plantVerified: verified,
    plantAgeDays: ageDays,
    careObservationCount: careStats?.total ?? 0,
    distinctCarers: careStats?.carers ?? 0,
    hasNonFounderCarer: (careStats?.nonFounder ?? 0) > 0,
  });
  if (eligible) {
    const paid = await payFounderBonus('plant_established', plant.id, plant.plantedBy, POINTS.plantEstablished);
    if (paid) await awardBadges(plant.plantedBy, ['plant_established']);
  }
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

  let pointsAwarded = 0;
  let note: string | undefined;
  let newBadges: string[] = [];

  try {
    const now = new Date();
    const [user] = await db
      .select({ createdAt: users.createdAt, karma: users.karma })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { ok: false, error: 'Account not found.' };

    const [earned24h, [earningPlantsRow]] = await Promise.all([
      earnedInLast24h(userId, now),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(karmaEvents)
        .where(
          and(
            eq(karmaEvents.userId, userId),
            eq(karmaEvents.kind, 'plant_new'),
            gt(karmaEvents.points, 0),
            gt(karmaEvents.createdAt, new Date(now.getTime() - DAY_MS))
          )
        ),
    ]);

    const [plant] = await db
      .insert(plants)
      .values({
        speciesId: input.speciesId,
        lat: input.lat,
        lng: input.lng,
        plantedBy: userId,
        nickname: input.nickname.trim().slice(0, 80) || null,
        description: input.description.trim().slice(0, 500) || null,
        accessNotes: input.accessNotes.trim().slice(0, 300) || null,
        lastWateredAt: new Date(),
      })
      .returning({ id: plants.id });

    const award = plantNewPoints({
      earningPlantsLast24h: earningPlantsRow?.n ?? 0,
      accountCreatedAt: user.createdAt,
      currentKarma: user.karma,
      earnedLast24h: earned24h,
      now,
    });
    pointsAwarded = award.points;
    note = award.note;

    const statements: BatchItem[] = [
      db.insert(karmaEvents).values({ userId, plantId: plant.id, kind: 'plant_new', points: award.points }),
    ];
    if (award.points > 0) {
      statements.push(
        db.update(users).set({ karma: sql`${users.karma} + ${award.points}` }).where(eq(users.id, userId))
      );
    }
    await runBatch(statements);

    newBadges = await awardBadges(userId, ['plant_new']);
  } catch (error) {
    console.error('createPlant failed:', error);
    return { ok: false, error: 'Could not save the plant. Please try again.' };
  }

  revalidatePath('/');
  return { ok: true, pointsAwarded, newBadges, note };
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
  const photoUrl = input.photoUrl?.trim() || null;
  if (photoUrl && !/^https?:\/\//.test(photoUrl)) {
    return { ok: false, error: 'Photo URL must start with http:// or https://.' };
  }

  let newBadges: string[] = [];

  try {
    const now = new Date();
    const [row] = await db
      .select({ plant: plants, species: species })
      .from(plants)
      .innerJoin(species, eq(plants.speciesId, species.id))
      .where(eq(plants.id, input.plantId))
      .limit(1);
    if (!row) return { ok: false, error: 'Plant not found.' };
    const { plant, species: sp } = row;

    const preStatus = computeStatus(plant, sp);
    const isFounder = plant.plantedBy === userId;

    // Per-type input validation (mirrors the pre-karma behavior).
    if (input.type === 'photo' && !photoUrl && !caption) {
      return { ok: false, error: 'Add a photo URL or a note.' };
    }
    const diseaseTag = input.diseaseTag?.trim().slice(0, 50) || null;
    if (input.type === 'report' && !caption && !diseaseTag) {
      return { ok: false, error: 'Describe the issue or pick a tag.' };
    }

    const [user] = await db
      .select({ createdAt: users.createdAt, karma: users.karma })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { ok: false, error: 'Account not found.' };

    // Trust gates for resolve (and for whether a report flips plant status).
    const needsStanding = input.type === 'resolve' || input.type === 'report';
    const standing = needsStanding
      ? await stewardStanding(userId, plant.id, sp.wateringFrequencyDays, now)
      : { isSteward: false, isActiveSteward: false };
    const privilege = { karma: user.karma, isFounder, isActiveSteward: standing.isActiveSteward };

    if (input.type === 'resolve' && !canResolve(privilege)) {
      return {
        ok: false,
        error: 'Resolving alerts on plants you don’t steward needs Gardener trust (250 karma). Adopt this plant to help right away.',
      };
    }

    // Ledger kind used for cooldown lookups per action type.
    const cooldownKind: KarmaKind =
      input.type === 'water' ? 'water_due' : (input.type as KarmaKind);

    const [verified, lastByUser, lastOnPlant, latestAlertRow, earned24h] = await Promise.all([
      isPlantVerified(plant.id),
      latestEarningEventAt(cooldownKind, plant.id, userId),
      input.type === 'harvest' || input.type === 'resolve'
        ? latestEarningEventAt(cooldownKind, plant.id)
        : Promise.resolve(null),
      input.type === 'resolve'
        ? db
            .select({ id: observations.id, userId: observations.userId, createdAt: observations.createdAt })
            .from(observations)
            .where(and(eq(observations.plantId, plant.id), eq(observations.type, 'alert')))
            .orderBy(desc(observations.createdAt))
            .limit(1)
        : Promise.resolve([]),
      earnedInLast24h(userId, now),
    ]);
    const latestAlert = latestAlertRow[0] ?? null;

    const award = computeAward({
      actorId: userId,
      actionType: input.type,
      now,
      plant: {
        plantedBy: plant.plantedBy,
        plantedAt: plant.plantedAt,
        lastWateredAt: plant.lastWateredAt,
        status: preStatus,
      },
      species: { wateringFrequencyDays: sp.wateringFrequencyDays, daysToHarvest: sp.daysToHarvest },
      plantVerified: verified,
      hasPhoto: !!photoUrl,
      lastEarnedSameKindByUserAt: lastByUser,
      lastEarnedSameKindOnPlantAt: lastOnPlant,
      latestAlert,
      earnedLast24h: earned24h,
      accountCreatedAt: user.createdAt,
      currentKarma: user.karma,
    });

    // 1. The observation itself (needed for the ledger FK).
    const observationType = input.type === 'report' ? 'alert' : input.type;
    const [obs] = await db
      .insert(observations)
      .values({
        plantId: plant.id,
        userId,
        type: observationType,
        caption,
        photoUrl: input.type === 'photo' || input.type === 'harvest' ? photoUrl : null,
        harvestQuantity: input.type === 'harvest' ? input.harvestQuantity?.trim().slice(0, 100) || null : null,
        diseaseTag: input.type === 'report' ? diseaseTag : null,
      })
      .returning({ id: observations.id });

    // 2. Plant column updates + ledger rows + karma increment, atomically.
    const plantUpdate: Record<string, unknown> = { lastCheckedAt: now };
    if (input.type === 'water') plantUpdate.lastWateredAt = now;
    if (input.type === 'report' && canFlipStatus(privilege)) {
      plantUpdate.status = diseaseTag ? 'diseased' : 'needs_attention';
    }
    if (input.type === 'resolve') plantUpdate.status = 'growing';

    const statements: BatchItem[] = [
      db.update(plants).set(plantUpdate).where(eq(plants.id, plant.id)),
      db.insert(karmaEvents).values({
        userId,
        plantId: plant.id,
        observationId: obs.id,
        kind: award.kind,
        points: award.points,
      }),
    ];
    if (award.rescueBonus > 0) {
      statements.push(
        db.insert(karmaEvents).values({
          userId,
          plantId: plant.id,
          observationId: obs.id,
          kind: 'rescue_bonus',
          points: award.rescueBonus,
        })
      );
    }
    const totalPoints = award.points + award.rescueBonus;
    if (totalPoints > 0) {
      statements.push(
        db.update(users).set({ karma: sql`${users.karma} + ${totalPoints}` }).where(eq(users.id, userId))
      );
    }
    await runBatch(statements);

    // 3. Resolving someone else's alert retroactively pays the reporter —
    //    this is the only way report points exist, so false flags never pay.
    if (input.type === 'resolve' && latestAlert && latestAlert.userId !== userId) {
      const [alreadyPaid] = await db
        .select({ id: karmaEvents.id })
        .from(karmaEvents)
        .where(and(eq(karmaEvents.observationId, latestAlert.id), eq(karmaEvents.kind, 'report_confirmed')))
        .limit(1);
      if (!alreadyPaid) {
        const reporterPoints = reportConfirmedPoints(latestAlert.userId, plant.plantedBy);
        await runBatch([
          db.insert(karmaEvents).values({
            userId: latestAlert.userId,
            plantId: plant.id,
            observationId: latestAlert.id,
            kind: 'report_confirmed',
            points: reporterPoints,
          }),
          db
            .update(users)
            .set({ karma: sql`${users.karma} + ${reporterPoints}` })
            .where(eq(users.id, latestAlert.userId)),
        ]);
        await awardBadges(latestAlert.userId, ['report_confirmed']);
      }
    }

    // 4. Deferred founder bonuses (once per plant, cap-exempt).
    const verifiedNow = verified || !!photoUrl;
    if (input.type === 'harvest' && verifiedNow) {
      const paid = await payFounderBonus('plant_first_harvest', plant.id, plant.plantedBy, POINTS.plantFirstHarvest);
      if (paid) await awardBadges(plant.plantedBy, ['plant_first_harvest']);
    }
    await maybePayEstablishedBonus(
      { id: plant.id, plantedBy: plant.plantedBy, plantedAt: plant.plantedAt },
      verifiedNow,
      now
    );

    // 5. Badges for the actor.
    const kindsLogged: KarmaKind[] = [award.kind];
    if (award.rescueBonus > 0) kindsLogged.push('rescue_bonus');
    newBadges = await awardBadges(userId, kindsLogged);

    revalidatePath('/');
    revalidatePath(`/plants/${input.plantId}`);
    revalidatePath('/leaderboard');
    return {
      ok: true,
      pointsAwarded: award.points + award.rescueBonus,
      newBadges,
      note: award.note,
    };
  } catch (error) {
    console.error('logCareAction failed:', error);
    return { ok: false, error: 'Could not save the action. Please try again.' };
  }
}

export async function updatePlantDetails(input: {
  plantId: number;
  nickname: string;
  description: string;
  accessNotes: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  try {
    const now = new Date();
    const [row] = await db
      .select({ plant: plants, species: species })
      .from(plants)
      .innerJoin(species, eq(plants.speciesId, species.id))
      .where(eq(plants.id, input.plantId))
      .limit(1);
    if (!row) return { ok: false, error: 'Plant not found.' };
    const { plant, species: sp } = row;

    const [user] = await db
      .select({ karma: users.karma })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { ok: false, error: 'Account not found.' };

    const standing = await stewardStanding(userId, plant.id, sp.wateringFrequencyDays, now);
    const allowed = canEditPlant({
      karma: user.karma,
      isFounder: plant.plantedBy === userId,
      isActiveSteward: standing.isActiveSteward,
      isSteward: standing.isSteward,
    });
    if (!allowed) {
      return {
        ok: false,
        error: 'Editing plant details needs Gardener trust (250 karma) as a steward, or Caretaker trust (600 karma) otherwise.',
      };
    }

    await db
      .update(plants)
      .set({
        nickname: input.nickname.trim().slice(0, 80) || null,
        description: input.description.trim().slice(0, 500) || null,
        accessNotes: input.accessNotes.trim().slice(0, 300) || null,
      })
      .where(eq(plants.id, plant.id));
  } catch (error) {
    console.error('updatePlantDetails failed:', error);
    return { ok: false, error: 'Could not save the changes. Please try again.' };
  }

  revalidatePath('/');
  revalidatePath(`/plants/${input.plantId}`);
  return { ok: true };
}
