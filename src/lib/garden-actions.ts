'use server';

import { db, runBatch, type BatchItem } from '@/db';
import { gardens, gardenMembers, plants } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { emailVerificationBlocker, requireUserId } from './auth-helpers';
import { gardenTag } from './garden-data';
import {
  isGardenKind,
  MAX_BED_LABEL,
  MAX_GARDEN_DESCRIPTION,
  MAX_GARDEN_NAME,
  MAX_GARDEN_RADIUS_M,
  MAX_GARDENS_PER_USER,
  MIN_GARDEN_RADIUS_M,
} from './garden-kinds';
import type { ActionResult } from './types';

/**
 * Gardens group plants that share a physical place. Everything here follows
 * the conventions in plant-actions.ts: hand-rolled validation, machine-key
 * errors resolved client-side by `actionMsg()` so messages stay localized, and
 * multi-statement writes through `runBatch` because the Neon HTTP driver has
 * no interactive transactions.
 *
 * Only mutations live here — a `'use server'` module may export nothing but
 * async functions, and anything exported becomes a client-callable endpoint.
 * Read helpers are plain server functions in garden-data.ts.
 */

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    // Keep Hebrew — this app is bilingual and "גינת השכונה" must not slug to "".
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'garden';
}

/** Appends a short random suffix so two "Back Garden"s can coexist. */
function uniqueSlug(name: string): string {
  return `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createGarden(input: {
  name: string;
  kind: string;
  description?: string;
  lat: number;
  lng: number;
  radiusM?: number;
}): Promise<ActionResult & { gardenId?: number; slug?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };

  const verificationError = await emailVerificationBlocker(userId);
  if (verificationError) return { ok: false, error: verificationError };

  const name = input.name.trim().slice(0, MAX_GARDEN_NAME);
  if (!name) return { ok: false, error: 'error_garden_name' };

  const kind = isGardenKind(input.kind) ? input.kind : 'patch';

  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 ||
    Math.abs(input.lng) > 180
  ) {
    return { ok: false, error: 'error_location' };
  }

  const radiusM = Math.round(
    Math.min(MAX_GARDEN_RADIUS_M, Math.max(MIN_GARDEN_RADIUS_M, input.radiusM ?? 25))
  );

  try {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(gardens)
      .where(eq(gardens.ownerId, userId));
    if (n >= MAX_GARDENS_PER_USER) return { ok: false, error: 'error_garden_cap' };

    const [garden] = await db
      .insert(gardens)
      .values({
        name,
        slug: uniqueSlug(name),
        kind,
        description: input.description?.trim().slice(0, MAX_GARDEN_DESCRIPTION) || null,
        ownerId: userId,
        lat: input.lat,
        lng: input.lng,
        radiusM,
      })
      .returning({ id: gardens.id, slug: gardens.slug });

    // The owner is a keeper of their own garden, so community permission checks
    // don't need a special case for them.
    await db
      .insert(gardenMembers)
      .values({ gardenId: garden.id, userId, role: 'keeper' })
      .onConflictDoNothing();

    revalidatePath('/[locale]/(tabs)/garden', 'page');
    return { ok: true, gardenId: garden.id, slug: garden.slug };
  } catch (error) {
    console.error('createGarden failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}

/** Founder or a community keeper may reorganise a garden. */
async function canManageGarden(gardenId: number, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ ownerId: gardens.ownerId, role: gardenMembers.role })
    .from(gardens)
    .leftJoin(
      gardenMembers,
      and(eq(gardenMembers.gardenId, gardens.id), eq(gardenMembers.userId, userId))
    )
    .where(eq(gardens.id, gardenId))
    .limit(1);
  if (!row) return false;
  return row.ownerId === userId || row.role === 'keeper';
}

/**
 * Moves a plant into a garden (or out of one, with `gardenId: null`) and
 * optionally onto a bed. Only the plant's founder can do this — stewardship is
 * about care, not about filing.
 */
export async function assignPlantToGarden(input: {
  plantId: number;
  gardenId: number | null;
  bedLabel?: string | null;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };

  try {
    const [plant] = await db
      .select({ id: plants.id, founderId: plants.plantedBy, gardenId: plants.gardenId })
      .from(plants)
      .where(eq(plants.id, input.plantId))
      .limit(1);
    if (!plant) return { ok: false, error: 'error_not_found' };
    if (plant.founderId !== userId) return { ok: false, error: 'error_not_founder' };

    if (input.gardenId !== null) {
      const allowed = await canManageGarden(input.gardenId, userId);
      if (!allowed) return { ok: false, error: 'error_not_garden_keeper' };
    }

    const bedLabel = input.bedLabel?.trim().slice(0, MAX_BED_LABEL) || null;

    // Counters move with the plant. Atomic SQL rather than read-modify-write:
    // no interactive transactions on the HTTP driver.
    const statements: BatchItem[] = [
      db
        .update(plants)
        .set({ gardenId: input.gardenId, bedLabel })
        .where(eq(plants.id, input.plantId)),
    ];
    if (plant.gardenId !== null && plant.gardenId !== input.gardenId) {
      statements.push(
        db
          .update(gardens)
          .set({ plantCount: sql`greatest(${gardens.plantCount} - 1, 0)` })
          .where(eq(gardens.id, plant.gardenId))
      );
    }
    if (input.gardenId !== null && plant.gardenId !== input.gardenId) {
      statements.push(
        db
          .update(gardens)
          .set({ plantCount: sql`${gardens.plantCount} + 1` })
          .where(eq(gardens.id, input.gardenId))
      );
    }

    await runBatch(statements);

    revalidatePath('/[locale]/(tabs)/garden', 'page');
    revalidatePath('/[locale]/plants/[id]', 'page');
    return { ok: true };
  } catch (error) {
    console.error('assignPlantToGarden failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}

export async function updateGardenDetails(input: {
  gardenId: number;
  name?: string;
  description?: string;
  radiusM?: number;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'error_signed_out' };

  try {
    if (!(await canManageGarden(input.gardenId, userId))) {
      return { ok: false, error: 'error_not_garden_keeper' };
    }

    const patch: Partial<typeof gardens.$inferInsert> = {};
    if (input.name !== undefined) {
      const name = input.name.trim().slice(0, MAX_GARDEN_NAME);
      if (!name) return { ok: false, error: 'error_garden_name' };
      patch.name = name;
    }
    if (input.description !== undefined) {
      patch.description = input.description.trim().slice(0, MAX_GARDEN_DESCRIPTION) || null;
    }
    if (input.radiusM !== undefined && Number.isFinite(input.radiusM)) {
      patch.radiusM = Math.round(
        Math.min(MAX_GARDEN_RADIUS_M, Math.max(MIN_GARDEN_RADIUS_M, input.radiusM))
      );
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    const [updated] = await db
      .update(gardens)
      .set(patch)
      .where(eq(gardens.id, input.gardenId))
      .returning({ slug: gardens.slug });

    // The name and description are read through a `use cache` boundary for
    // generateMetadata, so a rename has to drop that entry or the shared link
    // keeps the old title.
    if (updated) updateTag(gardenTag(updated.slug));
    revalidatePath('/[locale]/gardens/[slug]', 'page');
    revalidatePath('/[locale]/(tabs)/garden', 'page');
    return { ok: true };
  } catch (error) {
    console.error('updateGardenDetails failed:', error);
    return { ok: false, error: 'error_generic' };
  }
}
