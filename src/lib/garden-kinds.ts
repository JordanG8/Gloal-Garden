/**
 * Shared constants for gardens. Kept out of garden-actions.ts because a
 * `'use server'` module may only export async functions — a plain `const`
 * export there fails the build.
 */

export const GARDEN_KINDS = ['patch', 'plot', 'community'] as const;
export type GardenKind = (typeof GARDEN_KINDS)[number];

export const MAX_GARDEN_NAME = 60;
export const MAX_GARDEN_DESCRIPTION = 400;
export const MAX_BED_LABEL = 40;
export const MIN_GARDEN_RADIUS_M = 5;
/** Generous enough for a community orchard, small enough to stay a "place". */
export const MAX_GARDEN_RADIUS_M = 2000;
/** One person can only really tend so many places; also a cheap spam ceiling. */
export const MAX_GARDENS_PER_USER = 50;

export function isGardenKind(value: string): value is GardenKind {
  return (GARDEN_KINDS as readonly string[]).includes(value);
}
