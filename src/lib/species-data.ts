import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/db';
import { species } from '@/db/schema';
import { asc, ne } from 'drizzle-orm';

export interface SpeciesOption {
  id: number;
  name: string;
  nameHe: string | null;
  scientificName: string;
  category: string;
  emoji: string;
  isPerennial: boolean;
  /** Inclusive month window for perennials, so the picker can say when it fruits. */
  harvestMonthStart: number | null;
  harvestMonthEnd: number | null;
  waterIntervalSummerDays: number | null;
}

export const SPECIES_CATALOG_TAG = 'species:catalog';

/**
 * The species picker's options.
 *
 * Cached: this is a lookup table that changes only when a migration adds to it,
 * and every add-a-plant page view would otherwise re-read all of it. Excludes
 * the `__custom__` sentinel row, which exists only to give free-typed plants a
 * cadence to inherit and must never be shown to a human (see msg.ts).
 */
export async function getSpeciesCatalog(): Promise<SpeciesOption[]> {
  'use cache';
  cacheTag(SPECIES_CATALOG_TAG);
  cacheLife('days');

  try {
    const rows = await db
      .select({
        id: species.id,
        name: species.commonName,
        nameHe: species.commonNameHe,
        scientificName: species.scientificName,
        category: species.category,
        emoji: species.emoji,
        isPerennial: species.isPerennial,
        harvestMonthStart: species.harvestMonthStart,
        harvestMonthEnd: species.harvestMonthEnd,
        waterIntervalSummerDays: species.waterIntervalSummerDays,
      })
      .from(species)
      .where(ne(species.scientificName, '__custom__'))
      .orderBy(asc(species.commonName));

    return rows.map((row) => ({ ...row, isPerennial: row.isPerennial === 1 }));
  } catch (error) {
    // Everything rethrows, and that is the point of this catch existing at all.
    //
    // The usual "degrade gracefully, return []" reflex is actively wrong inside
    // a `use cache` boundary: a cached function that swallows an error caches
    // the fallback. A prerender abort, or a database that happens to be down
    // during the build, would bake an *empty* catalogue and then serve it for
    // the whole `cacheLife('days')` window — a species picker that silently
    // offers nothing, long after the database came back.
    //
    // Throwing means no cache entry is written, so the next request tries
    // again. /add already can't render without the database (it reads the
    // session), so this loses nothing that was working.
    console.error('Failed to load species catalog:', error);
    throw error;
  }
}
