/**
 * Assertions for the bulk-watering karma taper and the daily-cap threading.
 *
 * The cap threading is the important one. `computeAward` applies the daily cap
 * from `ctx.earnedLast24h`, and every existing caller reads that once before
 * acting — which is correct for a single plant and silently wrong in a loop:
 * each iteration would see the same pre-batch total, so watering thirty plants
 * would sail straight past a cap of 150. `waterBatch` threads a running total
 * forward instead, and this reproduces that arithmetic.
 *
 *   npx tsx scripts/checks/bulk-water-check.ts
 */

import {
  bulkWaterMultiplier,
  computeAward,
  dailyCapFor,
  DAILY_CAP,
  NEW_ACCOUNT_CAP,
  POINTS,
} from '../../src/lib/karma';

let failures = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures += 1;
  }
}

const NOW = new Date('2026-07-15T09:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const OLD_ACCOUNT = new Date(NOW.getTime() - 400 * DAY);
const NEW_ACCOUNT = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);

/** A thirsty plant on a 10-day summer cadence, 30 days dry, photo-verified. */
function thirstyPlant(founderId: number) {
  return {
    plantedBy: founderId,
    plantedAt: new Date(NOW.getTime() - 400 * DAY),
    lastWateredAt: new Date(NOW.getTime() - 30 * DAY),
    status: 'needs_water',
    careMode: 'scheduled',
    waterIntervalSummerDays: null,
    waterIntervalWinterDays: null,
  };
}

const lemon = {
  wateringFrequencyDays: 10,
  daysToHarvest: null,
  isPerennial: 1,
  harvestMonthStart: 11,
  harvestMonthEnd: 3,
  yearsToFirstHarvest: 3,
  waterIntervalSummerDays: 10,
  waterIntervalWinterDays: 0,
};

/** Mirrors the loop in waterBatch: running total threaded forward, then taper. */
function simulateBatch(
  plantCount: number,
  accountCreatedAt: Date,
  currentKarma: number,
  startingEarned = 0
): { total: number; perPlant: number[] } {
  const cap = dailyCapFor(accountCreatedAt, currentKarma, NOW);
  let running = startingEarned;
  const perPlant: number[] = [];

  for (let i = 0; i < plantCount; i += 1) {
    const award = computeAward({
      actorId: 1,
      actionType: 'water',
      now: NOW,
      // Founder waters their own, so no community multiplier muddying the maths.
      plant: thirstyPlant(1),
      species: lemon,
      plantVerified: true,
      hasPhoto: false,
      lastEarnedSameKindByUserAt: null,
      lastEarnedSameKindOnPlantAt: null,
      latestAlert: null,
      earnedLast24h: running,
      accountCreatedAt,
      currentKarma,
    });
    const tapered = Math.round(award.points * bulkWaterMultiplier(i));
    const points = Math.max(0, Math.min(tapered, cap - running));
    running += points;
    perPlant.push(points);
  }

  return { total: running - startingEarned, perPlant };
}

console.log('taper shape');
check('the first three plants pay in full', bulkWaterMultiplier(0) === 1 && bulkWaterMultiplier(2) === 1);
check('plants four through ten pay half', bulkWaterMultiplier(3) === 0.5 && bulkWaterMultiplier(9) === 0.5);
check('past ten pays nothing', bulkWaterMultiplier(10) === 0 && bulkWaterMultiplier(119) === 0);

console.log('a single plant is unchanged');
const single = simulateBatch(1, OLD_ACCOUNT, 500);
check(
  `one due plant still pays the full ${POINTS.waterDue}`,
  single.perPlant[0] === POINTS.waterDue
);

console.log('the daily cap actually holds');
const thirty = simulateBatch(30, OLD_ACCOUNT, 500);
check(`watering 30 plants stays within the ${DAILY_CAP} cap`, thirty.total <= DAILY_CAP);
check('and pays something rather than nothing', thirty.total > 0);
check(
  'the taper — not the cap — is what limits a 30-plant batch',
  thirty.total === POINTS.waterDue * 3 + Math.round(POINTS.waterDue * 0.5) * 7
);

console.log('the taper is what makes this safe at 120 plants');
const huge = simulateBatch(120, OLD_ACCOUNT, 500);
check(`a 120-plant garden cannot exceed the cap`, huge.total <= DAILY_CAP);
check(
  'and pays exactly the same as 30 plants — everything past ten is free labour',
  huge.total === thirty.total
);

console.log('the pre-batch total is respected');
const nearlyCapped = simulateBatch(30, OLD_ACCOUNT, 500, DAILY_CAP - 12);
check(
  'someone already near the cap earns only the remainder',
  nearlyCapped.total === 12
);
const capped = simulateBatch(30, OLD_ACCOUNT, 500, DAILY_CAP);
check('someone already at the cap earns nothing', capped.total === 0);

console.log('new accounts get the tighter cap');
const fresh = simulateBatch(30, NEW_ACCOUNT, 5);
check(
  `a new account cannot exceed ${NEW_ACCOUNT_CAP} in a batch`,
  fresh.total <= NEW_ACCOUNT_CAP
);

console.log('the bug this replaced');
// Without threading, every iteration sees the same pre-batch total, so the cap
// check never trips and 30 plants pay 30 x full price.
const unthreadedTotal = POINTS.waterDue * 30;
check(
  `the naive loop would have paid ${unthreadedTotal}, well past the ${DAILY_CAP} cap`,
  unthreadedTotal > DAILY_CAP && thirty.total < unthreadedTotal
);

console.log('');
if (failures > 0) {
  console.error(`${failures} bulk-water check(s) failed ✗`);
  process.exit(1);
}
console.log('All bulk-water checks passed ✓');
