/**
 * Sanity assertions for the karma economy — run with `npx tsx scripts/karma-check.ts`.
 * These encode the anti-abuse rules; if a tweak to karma.ts breaks one, this fails loudly.
 */
import {
  computeAward,
  plantNewPoints,
  reportConfirmedPoints,
  plantEstablishedEligible,
  trustLevelFor,
  adoptionCapFor,
  canFlipStatus,
  canResolve,
  isUpForAdoption,
  isStewardActive,
  activityWindowDays,
  evaluateBadges,
  DAILY_CAP,
  NEW_ACCOUNT_CAP,
  type AwardContext,
} from '../src/lib/karma';

let failures = 0;
function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}`);
  }
}

const NOW = new Date('2026-07-06T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const OLD_ACCOUNT = daysAgo(100);
const baseCtx: AwardContext = {
  actorId: 2,
  actionType: 'water',
  now: NOW,
  plant: {
    plantedBy: 1,
    plantedAt: daysAgo(40),
    lastWateredAt: daysAgo(3),
    status: 'needs_water',
    careMode: 'scheduled',
    waterIntervalSummerDays: null,
    waterIntervalWinterDays: null,
  },
  species: {
    wateringFrequencyDays: 2,
    daysToHarvest: 60,
    isPerennial: 0,
    harvestMonthStart: null,
    harvestMonthEnd: null,
    yearsToFirstHarvest: null,
    waterIntervalSummerDays: null,
    waterIntervalWinterDays: null,
  },
  plantVerified: true,
  hasPhoto: false,
  lastEarnedSameKindByUserAt: null,
  lastEarnedSameKindOnPlantAt: null,
  latestAlert: null,
  earnedLast24h: 0,
  accountCreatedAt: OLD_ACCOUNT,
  currentKarma: 100,
};

console.log('watering');
check('due water on someone else’s plant pays 15 (10 × 1.5)', computeAward(baseCtx).points === 15);
check('due water on your own plant pays 10', computeAward({ ...baseCtx, actorId: 1 }).points === 10);
check(
  'early watering pays 0',
  computeAward({ ...baseCtx, plant: { ...baseCtx.plant, lastWateredAt: daysAgo(0.5) } }).points === 0
);
check(
  'watering an unverified plant pays half (5 × 1.5 ≈ 8)',
  computeAward({ ...baseCtx, plantVerified: false }).points === 8
);
check(
  'rescuing a badly overdue plant adds the +8 bonus',
  computeAward({ ...baseCtx, plant: { ...baseCtx.plant, lastWateredAt: daysAgo(10) } }).rescueBonus === 8
);

console.log('photos');
const photoCtx: AwardContext = { ...baseCtx, actionType: 'photo', hasPhoto: true };
check('photo update on another’s plant pays 8 (5 × 1.5)', computeAward(photoCtx).points === 8);
check(
  'second photo within 24h pays 0',
  computeAward({ ...photoCtx, lastEarnedSameKindByUserAt: daysAgo(0.2) }).points === 0
);

console.log('harvests');
const harvestCtx: AwardContext = { ...baseCtx, actionType: 'harvest', hasPhoto: true };
check('photo-verified harvest of another’s plant pays 38 (25 × 1.5)', computeAward(harvestCtx).points === 38);
check('unphotographed harvest pays 18 (12 × 1.5)', computeAward({ ...harvestCtx, hasPhoto: false }).points === 18);
check(
  'harvest on an unverified plant with no photo pays 0',
  computeAward({ ...harvestCtx, plantVerified: false, hasPhoto: false }).points === 0
);
check(
  'harvesting a too-young plant pays 0',
  computeAward({ ...harvestCtx, plant: { ...harvestCtx.plant, plantedAt: daysAgo(10) } }).points === 0
);
check(
  'per-plant harvest cooldown blocks alt rotation',
  computeAward({ ...harvestCtx, lastEarnedSameKindOnPlantAt: daysAgo(0.5) }).points === 0
);

// Perennials carry no days_to_harvest — they fruit on a calendar window — so
// the age gate has to read `isPerennial` and `yearsToFirstHarvest` instead.
// Nothing here exercised that shape, which is why the gate could be disabled
// (by a caller that dropped those fields) without a single check going red.
console.log('harvests — perennials');
const youngTree: AwardContext = {
  ...harvestCtx,
  // Two years old, against a lemon that wants five. Note the gate allows a 40%
  // grace (a half-grown nursery tree crops earlier than a seed), so three years
  // would sit exactly on the boundary and pass.
  plant: { ...harvestCtx.plant, plantedAt: daysAgo(2 * 365) },
  species: {
    ...harvestCtx.species,
    daysToHarvest: null,
    isPerennial: 1,
    harvestMonthStart: 11,
    harvestMonthEnd: 3,
    yearsToFirstHarvest: 5,
  },
};
check(
  'harvesting a too-young tree pays 0 (no days_to_harvest to fall back on)',
  computeAward(youngTree).points === 0
);
check(
  'and says why',
  computeAward(youngTree).note === 'note_harvest_too_young'
);
check(
  'a mature tree harvests normally',
  computeAward({
    ...youngTree,
    plant: { ...youngTree.plant, plantedAt: daysAgo(12 * 365) },
  }).points === 38
);

console.log('reports & resolves');
check('filing a report pays 0 up front', computeAward({ ...baseCtx, actionType: 'report' }).points === 0);
const resolveCtx: AwardContext = {
  ...baseCtx,
  actionType: 'resolve',
  plant: { ...baseCtx.plant, status: 'needs_attention' },
  latestAlert: { userId: 3, createdAt: daysAgo(2) },
};
check('resolving another’s alert pays 15 + 8 rescue', computeAward(resolveCtx).points === 15 && computeAward(resolveCtx).rescueBonus === 8);
check(
  'resolving your OWN fresh alert pays 0 (report→resolve farming)',
  computeAward({ ...resolveCtx, latestAlert: { userId: 2, createdAt: daysAgo(0.5) } }).points === 0
);
check(
  'per-plant resolve cooldown blocks alt rotation',
  computeAward({ ...resolveCtx, lastEarnedSameKindOnPlantAt: daysAgo(1) }).points === 0
);
check('confirmed report pays reporter 9 (6 × 1.5)', reportConfirmedPoints(3, 1) === 9);
check('confirmed report on own plant pays 6', reportConfirmedPoints(1, 1) === 6);

console.log('caps & throttles');
check(
  'daily cap trims awards',
  computeAward({ ...baseCtx, earnedLast24h: DAILY_CAP - 5 }).points === 5
);
check(
  'new accounts hit the lower cap',
  computeAward({ ...baseCtx, accountCreatedAt: daysAgo(1), currentKarma: 0, earnedLast24h: NEW_ACCOUNT_CAP }).points === 0
);
check(
  '4th plant in 24h earns nothing',
  plantNewPoints({ earningPlantsLast24h: 3, accountCreatedAt: OLD_ACCOUNT, currentKarma: 100, earnedLast24h: 0, now: NOW }).points === 0
);
check(
  'new account earns for only 1 plant per day',
  plantNewPoints({ earningPlantsLast24h: 1, accountCreatedAt: daysAgo(1), currentKarma: 0, earnedLast24h: 0, now: NOW }).points === 0
);

console.log('founder bonuses');
check(
  'plant_established needs a non-founder carer',
  !plantEstablishedEligible({ plantVerified: true, plantAgeDays: 40, careObservationCount: 5, distinctCarers: 1, hasNonFounderCarer: false })
);
check(
  'plant_established pays when the community joins in',
  plantEstablishedEligible({ plantVerified: true, plantAgeDays: 40, careObservationCount: 5, distinctCarers: 2, hasNonFounderCarer: true })
);
check(
  'unverified plants never establish',
  !plantEstablishedEligible({ plantVerified: false, plantAgeDays: 40, careObservationCount: 5, distinctCarers: 3, hasNonFounderCarer: true })
);

console.log('trust & privileges');
check('0 karma is a Seedling with cap 2', trustLevelFor(0).name === 'Seedling' && adoptionCapFor(0) === 2);
check('300 karma is a Gardener with cap 10', trustLevelFor(300).name === 'Gardener' && adoptionCapFor(300) === 10);
check('Seedling reports don’t flip status', !canFlipStatus({ karma: 0, isFounder: false, isActiveSteward: false }));
check('founders always flip status', canFlipStatus({ karma: 0, isFounder: true, isActiveSteward: false }));
check('Seedling can’t resolve strangers’ plants', !canResolve({ karma: 0, isFounder: false, isActiveSteward: false }));
check('active stewards resolve at any karma', canResolve({ karma: 0, isFounder: false, isActiveSteward: true }));

console.log('stewardship decay');
check('activity window is at least 14 days', activityWindowDays({ wateringFrequencyDays: 2 }) === 14);
check(
  'steward with recent care is active',
  isStewardActive({ lastActionAt: daysAgo(3), adoptedAt: daysAgo(60), windowDays: 14 }, NOW)
);
check(
  'steward with stale care has decayed',
  !isStewardActive({ lastActionAt: daysAgo(20), adoptedAt: daysAgo(60), windowDays: 14 }, NOW)
);
check(
  'fresh adoption grants a grace window',
  isStewardActive({ lastActionAt: null, adoptedAt: daysAgo(2), windowDays: 14 }, NOW)
);
check(
  'untouched plant past its window is up for adoption',
  isUpForAdoption(
    { status: 'growing', plantedAt: daysAgo(100), lastWateredAt: daysAgo(40), lastCheckedAt: null },
    { wateringFrequencyDays: 7 },
    NOW
  )
);

console.log('badges');
check(
  'badges award at thresholds and never twice',
  evaluateBadges({ plantsFounded: 1 }, []).some((b) => b.id === 'first_sprout') &&
    evaluateBadges({ plantsFounded: 1 }, ['first_sprout']).length === 0
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll karma economy checks passed ✓');
