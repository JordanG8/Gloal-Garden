/**
 * When does a plant need water, and when does it actually carry fruit.
 *
 * Pure functions, no imports — so `scripts/checks/` can exercise them the same
 * way `scripts/karma-check.ts` exercises the karma economy.
 *
 * Two things the original model got wrong, both of which matter most for the
 * plant this app will mostly hold — an established citrus tree leaning over a
 * garden wall into the street:
 *
 * 1. **Watering is seasonal.** In a Mediterranean climate a lemon wants water
 *    every ~10 days from April to October and essentially none from November to
 *    March, when the rain does it. A single `watering_frequency_days` is either
 *    wrong all summer or wrong all winter.
 *
 * 2. **A tree fruits on the calendar, not on a countdown.** `days_to_harvest`
 *    measured from planting describes a courgette. A mature lemon crops every
 *    winter, forever, no matter when it went in. Perennials use a month window
 *    plus an age at which they start bearing.
 */

export type CareMode = 'scheduled' | 'rain_fed' | 'observe_only';
export type PlantOrigin = 'planted_by_me' | 'already_there' | 'wild' | 'inherited';
export type DatePrecision = 'day' | 'month' | 'year' | 'unknown';

export const CARE_MODES: CareMode[] = ['scheduled', 'rain_fed', 'observe_only'];
export const PLANT_ORIGINS: PlantOrigin[] = [
  'planted_by_me',
  'already_there',
  'wild',
  'inherited',
];
export const DATE_PRECISIONS: DatePrecision[] = ['day', 'month', 'year', 'unknown'];

/** Fallback when neither the plant nor its species says anything. */
export const DEFAULT_SUMMER_INTERVAL_DAYS = 7;
export const DEFAULT_WINTER_INTERVAL_DAYS = 21;

/**
 * Northern-hemisphere Mediterranean dry season, inclusive. April through
 * October is the stretch that needs irrigation in Israel; the rest is rain.
 * Southern-hemisphere gardens get this backwards — worth deriving from the
 * plant's latitude once the app has users below the equator.
 */
const SUMMER_START_MONTH = 4;
const SUMMER_END_MONTH = 10;

export function isSummer(date: Date = new Date()): boolean {
  const month = date.getMonth() + 1;
  return month >= SUMMER_START_MONTH && month <= SUMMER_END_MONTH;
}

export interface CadenceSource {
  /** Per-plant override, when this one dries out faster than its species. */
  waterIntervalSummerDays?: number | null;
  waterIntervalWinterDays?: number | null;
}

export interface SpeciesCadence extends CadenceSource {
  /** The single-interval legacy column, used when no seasonal value exists. */
  wateringFrequencyDays?: number | null;
}

/**
 * Days between waterings right now: plant override, then species, then the
 * legacy single interval, then a default.
 *
 * Returns `null` for "do not water", which is a real answer — an established
 * street tree in winter, or any `observe_only` plant. Callers must treat null
 * as "never due" rather than coercing it to a number.
 */
export function wateringIntervalDays(
  plant: CadenceSource & { careMode?: string | null },
  species: SpeciesCadence,
  now: Date = new Date()
): number | null {
  const mode = (plant.careMode ?? 'scheduled') as CareMode;
  // Not yours to water. Never due, no matter what the species says.
  if (mode === 'observe_only') return null;

  const summer = isSummer(now);
  const fromPlant = summer ? plant.waterIntervalSummerDays : plant.waterIntervalWinterDays;
  const fromSpecies = summer
    ? species.waterIntervalSummerDays
    : species.waterIntervalWinterDays;

  // 0 is meaningful — "no watering this season" — so only fall through on
  // null/undefined, never on falsiness.
  const interval =
    fromPlant ??
    fromSpecies ??
    species.wateringFrequencyDays ??
    (summer ? DEFAULT_SUMMER_INTERVAL_DAYS : DEFAULT_WINTER_INTERVAL_DAYS);

  if (interval <= 0) return null;

  // An established plant is on its own roots; stretch the cadence rather than
  // pretending it needs the same attention as a seedling.
  if (mode === 'rain_fed') return summer ? interval * 2 : null;

  return interval;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** When this plant next wants water, or null if it never does. */
export function nextWaterDueAt(
  plant: CadenceSource & {
    careMode?: string | null;
    lastWateredAt?: Date | string | null;
    plantedAt: Date | string;
  },
  species: SpeciesCadence,
  now: Date = new Date()
): Date | null {
  const interval = wateringIntervalDays(plant, species, now);
  if (interval === null) return null;
  const since = plant.lastWateredAt ?? plant.plantedAt;
  return new Date(new Date(since).getTime() + interval * DAY_MS);
}

export function needsWater(
  plant: CadenceSource & {
    careMode?: string | null;
    lastWateredAt?: Date | string | null;
    plantedAt: Date | string;
  },
  species: SpeciesCadence,
  now: Date = new Date()
): boolean {
  const due = nextWaterDueAt(plant, species, now);
  return due !== null && due.getTime() <= now.getTime();
}

/**
 * Is `month` inside an inclusive window that may wrap the year end? Citrus is
 * the reason this has to handle wrapping: lemons run November to March.
 */
export function monthInWindow(month: number, start: number, end: number): boolean {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

export interface HarvestSpec {
  isPerennial?: number | null;
  harvestMonthStart?: number | null;
  harvestMonthEnd?: number | null;
  yearsToFirstHarvest?: number | null;
  daysToHarvest?: number | null;
}

export function ageInDays(plantedAt: Date | string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(plantedAt).getTime()) / DAY_MS);
}

/** Has this plant lived long enough to bear at all? */
export function oldEnoughToBear(
  plantedAt: Date | string,
  species: HarvestSpec,
  now: Date = new Date()
): boolean {
  if (species.isPerennial) {
    const years = species.yearsToFirstHarvest ?? 0;
    return ageInDays(plantedAt, now) >= years * 365;
  }
  if (species.daysToHarvest) return ageInDays(plantedAt, now) >= species.daysToHarvest - 7;
  return true;
}

/**
 * Whether the plant is carrying fruit right now.
 *
 * Perennials: mature enough, and the calendar is inside the fruiting window.
 * Annuals: the old ±7-day band around `days_to_harvest`, unchanged.
 */
export function readyToHarvest(
  plantedAt: Date | string,
  species: HarvestSpec,
  now: Date = new Date()
): boolean {
  if (species.isPerennial) {
    if (species.harvestMonthStart == null || species.harvestMonthEnd == null) return false;
    if (!oldEnoughToBear(plantedAt, species, now)) return false;
    return monthInWindow(now.getMonth() + 1, species.harvestMonthStart, species.harvestMonthEnd);
  }
  if (!species.daysToHarvest) return false;
  const age = ageInDays(plantedAt, now);
  return age >= species.daysToHarvest - 7 && age <= species.daysToHarvest + 7;
}

/**
 * The gate that stops someone farming karma by logging fake harvests.
 *
 * The original check was `daysToHarvest !== null && age < 0.6 * daysToHarvest`.
 * Giving perennials a null `daysToHarvest` — which the calendar model requires
 * — would have silently removed the gate for every tree in the database, making
 * a fake citrus harvest worth a free 38 points on a 48-hour cooldown. This
 * keeps a gate for both shapes.
 */
export function harvestTooYoung(
  plantedAt: Date | string,
  species: HarvestSpec,
  now: Date = new Date()
): boolean {
  if (species.isPerennial) {
    const years = species.yearsToFirstHarvest ?? 0;
    // Same 0.6 grace the annual path allows — a tree bought half-grown from a
    // nursery can crop earlier than a seed would.
    return ageInDays(plantedAt, now) < years * 365 * 0.6;
  }
  if (species.daysToHarvest == null) return false;
  return ageInDays(plantedAt, now) < species.daysToHarvest * 0.6;
}

/**
 * A plant nobody is expected to water shouldn't be advertised as neglected.
 * Used to keep observe_only street trees out of the "needs a steward" pool.
 */
export function expectsWatering(careMode: string | null | undefined): boolean {
  return (careMode ?? 'scheduled') !== 'observe_only';
}

/** Formats a planting date honestly given how well it's actually known. */
export function plantedAtLabel(
  plantedAt: Date | string,
  precision: string | null | undefined,
  locale: string
): string {
  const date = new Date(plantedAt);
  switch ((precision ?? 'day') as DatePrecision) {
    case 'year':
      return String(date.getFullYear());
    case 'month':
      return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    case 'unknown':
      return '';
    default:
      return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
