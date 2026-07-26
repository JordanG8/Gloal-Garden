import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/db';
import { species } from '@/db/schema';
import { asc, ne } from 'drizzle-orm';
import { rethrowIfPrerenderAbort } from './prerender';

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
    // Critical: a prerender abort must not be swallowed here. The catch would
    // turn it into a perfectly valid-looking *empty* catalogue, and because
    // this function is cached, that empty result would then be served for
    // `cacheLife('days')` — a species picker that silently offers nothing.
    // Same reasoning as the readers in data.ts.
    rethrowIfPrerenderAbort(error);
    // A real database failure degrades to free text, which is the behaviour
    // the app had before the picker existed.
    console.error('Failed to load species catalog:', error);
    return [];
  }
}
