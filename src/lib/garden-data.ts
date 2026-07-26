import 'server-only';
import { connection } from 'next/server';
import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/db';
import { gardens, gardenMembers, plants, species, users } from '@/db/schema';
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { computeStatus } from './plant-status';
import { needsWater } from './care-schedule';
import { isUpForAdoption } from './karma';
import { rethrowIfPrerenderAbort } from './prerender';
import type { GardenKind } from './garden-kinds';
import type { PlantSummary } from './types';

/**
 * Garden reads. Plain server functions rather than server actions — these are
 * only ever called during render, and exporting them from a `'use server'`
 * module would publish them as client-callable endpoints for no reason.
 */

export interface GardenSummary {
  id: number;
  slug: string;
  name: string;
  kind: GardenKind;
  description: string | null;
  lat: number;
  lng: number;
  radiusM: number;
  plantCount: number;
  ownerId: number;
  ownerName: string;
  createdAt: string;
}

/** Plants filed under one bed label. `label: null` is "not on a bed yet". */
export interface Bed {
  label: string | null;
  plants: PlantSummary[];
  /** How many of these actually want water right now — drives batch care. */
  dueCount: number;
}

export interface GardenDetail {
  garden: GardenSummary;
  beds: Bed[];
  /** Total due across the whole garden. */
  dueCount: number;
  members: { id: number; name: string; avatar: string | null; role: string }[];
  viewerCanManage: boolean;
}

function toSummary(row: {
  garden: typeof gardens.$inferSelect;
  ownerName: string;
}): GardenSummary {
  return {
    id: row.garden.id,
    slug: row.garden.slug,
    name: row.garden.name,
    kind: row.garden.kind as GardenKind,
    description: row.garden.description,
    lat: row.garden.lat,
    lng: row.garden.lng,
    radiusM: row.garden.radiusM,
    plantCount: row.garden.plantCount,
    ownerId: row.garden.ownerId,
    ownerName: row.ownerName,
    createdAt: row.garden.createdAt.toISOString(),
  };
}

/** Cache tag for one garden's public, viewer-agnostic details. */
export function gardenTag(slug: string): string {
  return `garden:${slug}`;
}

/**
 * Just enough for `generateMetadata` — name and description, no viewer.
 *
 * Cached rather than dynamic because metadata is generated *outside* any
 * `<Suspense>` boundary, and under `cacheComponents` an uncached read there
 * blocks the whole route from rendering (the build fails with
 * `blocking-route`). A garden's name is viewer-agnostic and changes rarely, so
 * caching it is also just correct. Invalidated by `updateGardenDetails`.
 */
export async function getGardenMeta(
  slug: string
): Promise<{ name: string; description: string | null } | null> {
  'use cache';
  cacheTag(gardenTag(slug));
  cacheLife('hours');

  try {
    const [row] = await db
      .select({ name: gardens.name, description: gardens.description })
      .from(gardens)
      .where(eq(gardens.slug, slug))
      .limit(1);
    return row ?? null;
  } catch {
    // Never surface a DB hiccup as a build failure — the page itself still
    // renders the real thing inside Suspense.
    return null;
  }
}

/** Gardens the viewer owns or is a member of. */
export async function getMyGardens(userId: number): Promise<GardenSummary[]> {
  await connection();
  try {
    const rows = await db
      .selectDistinct({ garden: gardens, ownerName: users.displayName })
      .from(gardens)
      .innerJoin(users, eq(gardens.ownerId, users.id))
      .leftJoin(gardenMembers, eq(gardenMembers.gardenId, gardens.id))
      .where(sql`${gardens.ownerId} = ${userId} or ${gardenMembers.userId} = ${userId}`)
      .orderBy(desc(gardens.plantCount), asc(gardens.name));
    return rows.map(toSummary);
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load gardens:', error);
    return [];
  }
}

/**
 * A garden and everything in it, grouped by bed. This is the read that makes a
 * hundred-plant plot navigable — without the grouping it's a wall of cards.
 */
export async function getGardenDetail(
  slug: string,
  viewerId: number | null
): Promise<GardenDetail | null> {
  await connection();
  try {
    const [row] = await db
      .select({ garden: gardens, ownerName: users.displayName })
      .from(gardens)
      .innerJoin(users, eq(gardens.ownerId, users.id))
      .where(eq(gardens.slug, slug))
      .limit(1);
    if (!row) return null;

    const [plantRows, memberRows] = await Promise.all([
      db
        .select({ plant: plants, species: species, plantedByName: users.displayName })
        .from(plants)
        .innerJoin(species, eq(plants.speciesId, species.id))
        .innerJoin(users, eq(plants.plantedBy, users.id))
        .where(and(eq(plants.gardenId, row.garden.id), ne(plants.status, 'removed')))
        // NULLS LAST so unfiled plants sort to the bottom, under their own heading.
        .orderBy(sql`${plants.bedLabel} asc nulls last`, desc(plants.plantedAt)),
      db
        .select({
          id: users.id,
          name: users.displayName,
          avatar: users.avatar,
          role: gardenMembers.role,
        })
        .from(gardenMembers)
        .innerJoin(users, eq(gardenMembers.userId, users.id))
        .where(eq(gardenMembers.gardenId, row.garden.id))
        .orderBy(desc(gardenMembers.role), asc(gardenMembers.createdAt)),
    ]);

    // The query is already ordered by bed label, so a single pass groups it.
    const beds: Bed[] = [];
    for (const { plant, species: sp, plantedByName } of plantRows) {
      const summary: PlantSummary = {
        id: plant.id,
        name: plant.nickname || plant.customSpeciesName || sp.commonName,
        quantity: plant.quantity,
        gardenId: plant.gardenId,
        bedLabel: plant.bedLabel,
        lat: plant.lat,
        lng: plant.lng,
        category: sp.category,
        speciesName: sp.commonName,
        speciesNameHe: sp.commonNameHe,
        emoji: sp.emoji,
        scientificName: sp.scientificName,
        customSpeciesName: plant.customSpeciesName,
        status: computeStatus(plant, sp),
        isNew: Date.now() - plant.plantedAt.getTime() < 14 * 24 * 60 * 60 * 1000,
        plantedAt: plant.plantedAt.toISOString(),
        lastWateredAt: plant.lastWateredAt?.toISOString() ?? null,
        plantedByName,
        founderId: plant.plantedBy,
        upForAdoption: isUpForAdoption(plant, sp),
        stewardCount: 0,
        description: plant.description,
        accessNotes: plant.accessNotes,
        wateringFrequencyDays: sp.wateringFrequencyDays,
        daysToHarvest: sp.daysToHarvest,
        latestPhotoUrl: plant.latestPhotoUrl,
        photoCount: plant.photoCount,
      };
      const due = needsWater(plant, sp);
      const last = beds[beds.length - 1];
      if (last && last.label === plant.bedLabel) {
        last.plants.push(summary);
        if (due) last.dueCount += 1;
      } else {
        beds.push({ label: plant.bedLabel, plants: [summary], dueCount: due ? 1 : 0 });
      }
    }

    const viewerCanManage =
      viewerId !== null &&
      (row.garden.ownerId === viewerId ||
        memberRows.some((m) => m.id === viewerId && m.role === 'keeper'));

    return {
      garden: toSummary(row),
      beds,
      dueCount: beds.reduce((total, bed) => total + bed.dueCount, 0),
      members: memberRows,
      viewerCanManage,
    };
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    console.error('Failed to load garden detail:', error);
    return null;
  }
}

/** Distinct bed labels in a garden, for the assign picker's suggestions. */
export async function getBedLabels(gardenId: number): Promise<string[]> {
  await connection();
  try {
    const rows = await db
      .selectDistinct({ bedLabel: plants.bedLabel })
      .from(plants)
      .where(and(eq(plants.gardenId, gardenId), sql`${plants.bedLabel} is not null`))
      .orderBy(asc(plants.bedLabel));
    return rows.map((r) => r.bedLabel).filter((label): label is string => !!label);
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    return [];
  }
}

/** The viewer's own plants that aren't filed into any garden yet. */
export async function getUnassignedPlants(
  userId: number
): Promise<{ id: number; name: string }[]> {
  await connection();
  try {
    const rows = await db
      .select({
        id: plants.id,
        nickname: plants.nickname,
        custom: plants.customSpeciesName,
        common: species.commonName,
      })
      .from(plants)
      .innerJoin(species, eq(plants.speciesId, species.id))
      .where(
        and(
          eq(plants.plantedBy, userId),
          isNull(plants.gardenId),
          ne(plants.status, 'removed')
        )
      )
      .orderBy(desc(plants.plantedAt));
    return rows.map((r) => ({ id: r.id, name: r.nickname || r.custom || r.common }));
  } catch (error) {
    rethrowIfPrerenderAbort(error);
    return [];
  }
}
