import { needsWater, readyToHarvest } from './care-schedule';

export type PlantStatus =
  | 'growing'
  | 'needs_water'
  | 'needs_attention'
  | 'ready_to_harvest'
  | 'diseased'
  | 'dormant'
  | 'removed';

// Statuses that are set explicitly (e.g. by a report) and stay until resolved,
// rather than being derived from watering/harvest timing.
const STICKY_STATUSES: PlantStatus[] = ['needs_attention', 'diseased', 'dormant', 'removed'];

interface StatusPlantInput {
  status: string;
  plantedAt: Date | string;
  lastWateredAt: Date | string | null;
  careMode?: string | null;
  waterIntervalSummerDays?: number | null;
  waterIntervalWinterDays?: number | null;
}

interface StatusSpeciesInput {
  daysToHarvest: number | null;
  wateringFrequencyDays: number | null;
  isPerennial?: number | null;
  harvestMonthStart?: number | null;
  harvestMonthEnd?: number | null;
  yearsToFirstHarvest?: number | null;
  waterIntervalSummerDays?: number | null;
  waterIntervalWinterDays?: number | null;
}

export function computeStatus(
  plant: StatusPlantInput,
  speciesInfo: StatusSpeciesInput,
  now: Date = new Date()
): PlantStatus {
  if (STICKY_STATUSES.includes(plant.status as PlantStatus)) {
    return plant.status as PlantStatus;
  }

  // Perennials fruit on a calendar window once mature; annuals still use the
  // ±7-day band around days_to_harvest. See care-schedule.ts.
  if (readyToHarvest(plant.plantedAt, speciesInfo, now)) return 'ready_to_harvest';

  // Returns false for observe_only plants and for anything whose seasonal
  // interval is zero — an established tree in winter is not neglected.
  if (needsWater(plant, speciesInfo, now)) return 'needs_water';

  return 'growing';
}

/**
 * Derives the map-pin / status-pill status from a plant summary: sticky
 * trouble statuses win, then time-derived ones, then "up for adoption" is
 * surfaced as its own pseudo-status ("steward"). Pure logic — kept out of
 * plant-marker.tsx (a 'use client' file) so server components can call it
 * without triggering a "called a client function from the server" crash.
 */
export function pinStatus(plant: {
  status: string;
  upForAdoption: boolean;
}): PlantStatus | 'steward' {
  if (plant.status === 'needs_attention' || plant.status === 'diseased') return 'needs_attention';
  if (plant.status === 'needs_water') return 'needs_water';
  if (plant.status === 'ready_to_harvest') return 'ready_to_harvest';
  if (plant.upForAdoption) return 'steward';
  return plant.status as PlantStatus;
}

// Tailwind classes for the status badge shown on plant heroes (deep green
// background, white text — "growing" gets a translucent pill so it doesn't
// vanish into the hero).
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  growing: 'bg-white/20 backdrop-blur-sm',
  needs_water: 'bg-blue-500/90',
  ready_to_harvest: 'bg-destructive/90',
  needs_attention: 'bg-orange-500/90',
  diseased: 'bg-orange-600/90',
  dormant: 'bg-stone-500/90',
};
