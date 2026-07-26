/**
 * Assertions over src/lib/care-schedule.ts — the seasonal watering and
 * perennial harvest logic. Same dependency-free style as
 * scripts/karma-check.ts: no test framework, run it and it either prints
 * ticks or throws.
 *
 *   npx tsx scripts/checks/care-schedule-check.ts
 */

import {
  harvestTooYoung,
  isSummer,
  monthInWindow,
  needsWater,
  nextWaterDueAt,
  readyToHarvest,
  wateringIntervalDays,
} from '../../src/lib/care-schedule';

let failures = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures += 1;
  }
}

function section(label: string) {
  console.log(label);
}

const JULY = new Date('2026-07-15T12:00:00Z');
const JANUARY = new Date('2026-01-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number, from: Date) => new Date(from.getTime() - n * DAY);

/** An established street lemon: someone else's tree, mapped for its fruit. */
const streetLemon = {
  careMode: 'observe_only',
  plantedAt: new Date('2005-01-01'),
  lastWateredAt: null,
  waterIntervalSummerDays: null,
  waterIntervalWinterDays: null,
};

/** A lemon in your own garden, on a schedule. */
const gardenLemon = {
  careMode: 'scheduled',
  plantedAt: new Date('2020-03-01'),
  lastWateredAt: daysAgo(12, JULY),
  waterIntervalSummerDays: null,
  waterIntervalWinterDays: null,
};

const lemonSpecies = {
  isPerennial: 1,
  harvestMonthStart: 11,
  harvestMonthEnd: 3,
  yearsToFirstHarvest: 3,
  waterIntervalSummerDays: 10,
  waterIntervalWinterDays: 0,
  wateringFrequencyDays: 10,
  daysToHarvest: null,
};

const courgetteSpecies = {
  isPerennial: 0,
  harvestMonthStart: null,
  harvestMonthEnd: null,
  yearsToFirstHarvest: null,
  waterIntervalSummerDays: 2,
  waterIntervalWinterDays: 5,
  wateringFrequencyDays: 3,
  daysToHarvest: 55,
};

section('seasons');
check('July is the dry season', isSummer(JULY));
check('January is not', !isSummer(JANUARY));

section('month windows');
check('a normal window contains its middle', monthInWindow(7, 6, 9));
check('a normal window excludes outside', !monthInWindow(4, 6, 9));
check('a wrapping window (Nov-Mar) contains December', monthInWindow(12, 11, 3));
check('a wrapping window contains February', monthInWindow(2, 11, 3));
check('a wrapping window excludes July', !monthInWindow(7, 11, 3));

section('watering cadence');
check(
  'a garden lemon wants water every 10 days in summer',
  wateringIntervalDays(gardenLemon, lemonSpecies, JULY) === 10
);
check(
  'the same lemon wants nothing in winter — the rain does it',
  wateringIntervalDays(gardenLemon, lemonSpecies, JANUARY) === null
);
check(
  'a per-plant override beats the species',
  wateringIntervalDays(
    { ...gardenLemon, waterIntervalSummerDays: 4 },
    lemonSpecies,
    JULY
  ) === 4
);
check(
  'an override of 0 means "no water", not "fall through to the species"',
  wateringIntervalDays(
    { ...gardenLemon, waterIntervalSummerDays: 0 },
    lemonSpecies,
    JULY
  ) === null
);
check(
  'a rain-fed plant gets double the interval in summer',
  wateringIntervalDays({ ...gardenLemon, careMode: 'rain_fed' }, lemonSpecies, JULY) === 20
);
check(
  'a rain-fed plant is never due in winter',
  wateringIntervalDays({ ...gardenLemon, careMode: 'rain_fed' }, lemonSpecies, JANUARY) === null
);
check(
  'an observe-only street tree is never on a cadence, even in high summer',
  wateringIntervalDays(streetLemon, lemonSpecies, JULY) === null
);
check(
  'a species with no seasonal data falls back to the legacy single interval',
  wateringIntervalDays(gardenLemon, { wateringFrequencyDays: 5 }, JULY) === 5
);

section('needs water');
check(
  'twelve days without water in July, on a ten-day cadence, is thirsty',
  needsWater(gardenLemon, lemonSpecies, JULY)
);
check(
  'the same plant in January is not thirsty',
  !needsWater({ ...gardenLemon, lastWateredAt: daysAgo(12, JANUARY) }, lemonSpecies, JANUARY)
);
check(
  'a street tree never reads as thirsty — this is the bug that made every mapped street tree look neglected',
  !needsWater(streetLemon, lemonSpecies, JULY)
);
check(
  'a freshly watered plant is not thirsty',
  !needsWater({ ...gardenLemon, lastWateredAt: daysAgo(1, JULY) }, lemonSpecies, JULY)
);
check(
  'due date is last watering plus the seasonal interval',
  nextWaterDueAt(
    { ...gardenLemon, lastWateredAt: new Date('2026-07-01T00:00:00Z') },
    lemonSpecies,
    JULY
  )?.toISOString() === new Date('2026-07-11T00:00:00Z').toISOString()
);
check('an observe-only plant has no due date at all', nextWaterDueAt(streetLemon, lemonSpecies, JULY) === null);

section('perennial harvest');
check(
  'a mature lemon carries fruit in January',
  readyToHarvest(new Date('2010-01-01'), lemonSpecies, JANUARY)
);
check(
  'the same tree carries nothing in July',
  !readyToHarvest(new Date('2010-01-01'), lemonSpecies, JULY)
);
check(
  'a two-year-old lemon is not bearing yet, even in season',
  !readyToHarvest(daysAgo(730, JANUARY), lemonSpecies, JANUARY)
);
check(
  'a four-year-old lemon is',
  readyToHarvest(daysAgo(4 * 365, JANUARY), lemonSpecies, JANUARY)
);
check(
  'harvest-readiness does not depend on when the tree was planted, only how old it is',
  readyToHarvest(new Date('1994-06-01'), lemonSpecies, JANUARY)
);

section('annual harvest still works');
check(
  'a courgette is ready around day 55',
  readyToHarvest(daysAgo(55, JULY), courgetteSpecies, JULY)
);
check(
  'and not on day 20',
  !readyToHarvest(daysAgo(20, JULY), courgetteSpecies, JULY)
);
check(
  'and not on day 90 — the window closes',
  !readyToHarvest(daysAgo(90, JULY), courgetteSpecies, JULY)
);

section('the harvest-farming gate');
check(
  'a one-year-old lemon is too young to have harvested anything',
  harvestTooYoung(daysAgo(365, JANUARY), lemonSpecies, JANUARY)
);
check(
  'a three-year-old lemon is not',
  !harvestTooYoung(daysAgo(3 * 365, JANUARY), lemonSpecies, JANUARY)
);
check(
  'the gate survives perennials having no days_to_harvest — the exploit this replaced',
  harvestTooYoung(daysAgo(30, JANUARY), { ...lemonSpecies, daysToHarvest: null }, JANUARY)
);
check(
  'annuals keep their 0.6 fraction gate',
  harvestTooYoung(daysAgo(20, JULY), courgetteSpecies, JULY)
);
check(
  'a species with no harvest data gates nothing',
  !harvestTooYoung(daysAgo(1, JULY), { daysToHarvest: null, isPerennial: 0 }, JULY)
);

console.log('');
if (failures > 0) {
  console.error(`${failures} care-schedule check(s) failed ✗`);
  process.exit(1);
}
console.log('All care-schedule checks passed ✓');
