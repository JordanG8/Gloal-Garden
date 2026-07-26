/**
 * The whole karma economy in one pure, DB-free file so it can be tweaked and
 * sanity-checked in isolation (see scripts/karma-check.ts).
 *
 * Design principles:
 *  - Food outcomes (harvests) pay best; due watering pays reliably.
 *  - Caring for OTHERS' plants pays more (community multiplier).
 *  - Planting is an investment (deferred founder bonuses), not a payday.
 *  - Points that can be farmed without a real plant benefiting must not exist.
 *
 * Exploit → countermeasure map:
 *  - Flag vandalism for points ......... reports pay 0 at filing; only a resolve
 *    by a DIFFERENT user pays the reporter retroactively (report_confirmed).
 *    Seedlings' reports also don't flip plant status (canFlipStatus).
 *  - Report→resolve farming solo ....... resolve pays 0 if the same user filed
 *    the alert less than 24h ago.
 *  - Report→resolve farming with alts .. earning resolves are limited per PLANT
 *    (72h), not just per user; new accounts get a lower daily cap.
 *  - Invisible/fake pins farmed with scheduled watering ... unverified plants
 *    (no photo evidence) earn half water and no harvest/founder bonuses.
 *  - Alt-founder ×1.5 multiplier trick .. plant_established needs care from 2+
 *    distinct users including a non-founder; new-account throttle applies.
 *  - Fake harvests ..................... verified-plant + age gates, per-user
 *    48h AND per-plant 24h cooldowns; photos are public in the feed.
 *  - Sybil armies ...................... email verification gates all
 *    karma-earning actions (when delivery is configured); plus new-account
 *    throttle, per-plant cooldowns, and the append-only ledger allows
 *    negative moderation_adjust reversals.
 */

import { expectsWatering, harvestTooYoung, wateringIntervalDays } from './care-schedule';

export type CareActionType = 'water' | 'photo' | 'harvest' | 'report' | 'resolve';

export type KarmaKind =
  | 'water_due'
  | 'water_early'
  | 'photo'
  | 'harvest'
  | 'report'
  | 'report_confirmed'
  | 'resolve'
  | 'plant_new'
  | 'plant_established'
  | 'plant_first_harvest'
  | 'adopt'
  | 'rescue_bonus'
  | 'moderation_adjust'
  | 'post_created'
  | 'comment_created'
  | 'post_score_5'
  | 'post_score_25'
  | 'comment_score_10';

export const POINTS = {
  waterDue: 10,
  waterDueUnverified: 5,
  photo: 5,
  photoNoteOnly: 2,
  harvest: 25,
  harvestNoPhoto: 12,
  reportConfirmed: 6,
  resolve: 10,
  plantNew: 10,
  plantEstablished: 15,
  plantFirstHarvest: 25,
  adopt: 3,
  rescueBonus: 8,
  // Posting pays nothing at creation, for the same reason filing a report
  // doesn't: a post nobody values shouldn't have paid. Value shows up as
  // threshold awards below.
  postCreated: 0,
  commentCreated: 1,
  postScore5: 5,
  postScore25: 15,
  commentScore10: 5,
} as const;

/**
 * Score thresholds at which an author is paid, once each, forever. Never
 * per-vote: a per-vote increment is farmable by toggling a vote off and on.
 * Paid through the same once-per-target ledger guard as the founder bonuses.
 */
export const POST_SCORE_AWARDS: { kind: KarmaKind; atScore: number; points: number }[] = [
  { kind: 'post_score_5', atScore: 5, points: POINTS.postScore5 },
  { kind: 'post_score_25', atScore: 25, points: POINTS.postScore25 },
];
export const COMMENT_SCORE_AWARDS: { kind: KarmaKind; atScore: number; points: number }[] = [
  { kind: 'comment_score_10', atScore: 10, points: POINTS.commentScore10 },
];

/** Posts per hour, per trust level index. A brand-new account gets three. */
export const POSTS_PER_HOUR = [3, 6, 10, 15, 25];
export const COMMENTS_PER_HOUR = [10, 20, 40, 60, 100];

export const COMMUNITY_MULTIPLIER = 1.5;
export const DAILY_CAP = 150;
export const NEW_ACCOUNT_CAP = 40;
export const NEW_ACCOUNT_MIN_AGE_HOURS = 48;
export const NEW_ACCOUNT_MIN_KARMA = 25;

export const DEFAULT_WATERING_FREQUENCY_DAYS = 7;
export const WATER_DUE_FRACTION = 0.75;
export const RESCUE_OVERDUE_MULTIPLE = 2;
export const HARVEST_MIN_AGE_FRACTION = 0.6;

export const PHOTO_USER_COOLDOWN_HOURS = 24;
export const HARVEST_USER_COOLDOWN_HOURS = 48;
export const HARVEST_PLANT_COOLDOWN_HOURS = 24;
export const RESOLVE_PLANT_COOLDOWN_HOURS = 72;
export const RESOLVE_OWN_ALERT_MIN_HOURS = 24;

export const PLANT_NEW_EARNING_PER_DAY = 3;
export const PLANT_NEW_EARNING_PER_DAY_NEW_ACCOUNT = 1;

export const PLANT_ESTABLISHED_MIN_AGE_DAYS = 30;
export const PLANT_ESTABLISHED_MIN_OBSERVATIONS = 3;

const STICKY_ALERT_STATUSES = ['needs_attention', 'diseased'];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function hoursSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / HOUR_MS;
}

function daysSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / DAY_MS;
}

// ---------------------------------------------------------------------------
// Award computation
// ---------------------------------------------------------------------------

export interface AwardContext {
  actorId: number;
  actionType: CareActionType;
  now: Date;
  plant: {
    plantedBy: number;
    plantedAt: Date;
    lastWateredAt: Date | null;
    /** Pre-action computed status (computeStatus). */
    status: string;
    careMode?: string | null;
    waterIntervalSummerDays?: number | null;
    waterIntervalWinterDays?: number | null;
  };
  species: {
    wateringFrequencyDays: number | null;
    daysToHarvest: number | null;
    isPerennial?: number | null;
    harvestMonthStart?: number | null;
    harvestMonthEnd?: number | null;
    yearsToFirstHarvest?: number | null;
    waterIntervalSummerDays?: number | null;
    waterIntervalWinterDays?: number | null;
  };
  /** Plant has at least one photo-bearing observation. */
  plantVerified: boolean;
  /** The action being logged carries a photo URL. */
  hasPhoto: boolean;
  /** Latest EARNING (points > 0) event of the same kind by this user on this plant. */
  lastEarnedSameKindByUserAt: Date | null;
  /** Latest EARNING event of the same kind on this plant by ANY user. */
  lastEarnedSameKindOnPlantAt: Date | null;
  /** Latest open alert on the plant (for resolve). */
  latestAlert: { userId: number; createdAt: Date } | null;
  /** Sum of this user's ledger points over the trailing 24h. */
  earnedLast24h: number;
  accountCreatedAt: Date;
  currentKarma: number;
}

export interface AwardResult {
  kind: KarmaKind;
  /** Final points after multiplier and daily cap. */
  points: number;
  /** Pre-multiplier, pre-cap base — for the karma breakdown UI. */
  basePoints: number;
  /** Rescue bonus, capped, recorded as a separate ledger row when > 0. */
  rescueBonus: number;
  /** Microcopy shown to the user when nothing (or less) was earned. */
  note?: string;
}

export function isNewAccount(accountCreatedAt: Date, karma: number, now: Date): boolean {
  return (
    hoursSince(accountCreatedAt, now) < NEW_ACCOUNT_MIN_AGE_HOURS && karma < NEW_ACCOUNT_MIN_KARMA
  );
}

export function dailyCapFor(accountCreatedAt: Date, karma: number, now: Date): number {
  return isNewAccount(accountCreatedAt, karma, now) ? NEW_ACCOUNT_CAP : DAILY_CAP;
}

function applyMultiplier(base: number, isCommunityAction: boolean): number {
  return isCommunityAction ? Math.round(base * COMMUNITY_MULTIPLIER) : base;
}

export function computeAward(ctx: AwardContext): AwardResult {
  const { now, plant, species } = ctx;
  const isCommunity = plant.plantedBy !== ctx.actorId;
  // The seasonal cadence, so "was this due?" agrees with what the map showed.
  // Null means the plant is never due — observe_only, or a species that wants
  // no water this season.
  const resolvedInterval = wateringIntervalDays(plant, species, now);
  const freq = resolvedInterval ?? species.wateringFrequencyDays ?? DEFAULT_WATERING_FREQUENCY_DAYS;
  const lastWatered = plant.lastWateredAt ?? plant.plantedAt;

  let kind: KarmaKind;
  let base = 0;
  let rescue = 0;
  let note: string | undefined;

  switch (ctx.actionType) {
    case 'water': {
      const sinceWaterDays = daysSince(lastWatered, now);
      // Watering a tree that isn't yours to water is a kind thought, not a
      // chore the garden needed doing.
      if (resolvedInterval === null) {
        kind = 'water_early';
        note = 'note_water_not_needed';
      } else if (sinceWaterDays >= WATER_DUE_FRACTION * freq) {
        kind = 'water_due';
        base = ctx.plantVerified ? POINTS.waterDue : POINTS.waterDueUnverified;
        if (!ctx.plantVerified) note = 'note_unverified_half';
        const wasCritical = STICKY_ALERT_STATUSES.includes(plant.status);
        if (wasCritical || sinceWaterDays >= RESCUE_OVERDUE_MULTIPLE * freq) {
          rescue = POINTS.rescueBonus;
        }
      } else {
        kind = 'water_early';
        note = 'note_water_not_due';
      }
      break;
    }

    case 'photo': {
      kind = 'photo';
      const onCooldown =
        ctx.lastEarnedSameKindByUserAt !== null &&
        hoursSince(ctx.lastEarnedSameKindByUserAt, now) < PHOTO_USER_COOLDOWN_HOURS;
      if (onCooldown) {
        note = 'note_photo_cooldown';
      } else {
        base = ctx.hasPhoto ? POINTS.photo : POINTS.photoNoteOnly;
      }
      break;
    }

    case 'harvest': {
      kind = 'harvest';
      // A photo on the harvest itself is the same public evidence a
      // verification photo would be, so it counts.
      const verified = ctx.plantVerified || ctx.hasPhoto;
      // Perennials carry no `days_to_harvest` — they fruit on a calendar
      // window instead — so the old `daysToHarvest !== null` guard would have
      // silently removed this gate for every tree, making a fake citrus
      // harvest free at 38 points a pop. harvestTooYoung handles both shapes.
      const tooYoung = harvestTooYoung(ctx.plant.plantedAt, species, now);
      const userCooldown =
        ctx.lastEarnedSameKindByUserAt !== null &&
        hoursSince(ctx.lastEarnedSameKindByUserAt, now) < HARVEST_USER_COOLDOWN_HOURS;
      const plantCooldown =
        ctx.lastEarnedSameKindOnPlantAt !== null &&
        hoursSince(ctx.lastEarnedSameKindOnPlantAt, now) < HARVEST_PLANT_COOLDOWN_HOURS;

      if (!verified) {
        note = 'note_harvest_unverified';
      } else if (tooYoung) {
        note = 'note_harvest_too_young';
      } else if (userCooldown || plantCooldown) {
        note = 'note_harvest_cooldown';
      } else {
        base = ctx.hasPhoto ? POINTS.harvest : POINTS.harvestNoPhoto;
        if (!ctx.hasPhoto) note = 'note_harvest_photo_tip';
      }
      break;
    }

    case 'report': {
      // Reports never pay at filing — a false flag never gets honestly
      // confirmed. The reporter is paid via report_confirmed when a DIFFERENT
      // user resolves the alert.
      kind = 'report';
      note = 'note_report_pending';
      break;
    }

    case 'resolve': {
      kind = 'resolve';
      const wasSticky = STICKY_ALERT_STATUSES.includes(plant.status);
      const ownRecentAlert =
        ctx.latestAlert !== null &&
        ctx.latestAlert.userId === ctx.actorId &&
        hoursSince(ctx.latestAlert.createdAt, now) < RESOLVE_OWN_ALERT_MIN_HOURS;
      const plantCooldown =
        ctx.lastEarnedSameKindOnPlantAt !== null &&
        hoursSince(ctx.lastEarnedSameKindOnPlantAt, now) < RESOLVE_PLANT_COOLDOWN_HOURS;

      if (!wasSticky) {
        note = 'note_resolve_no_alert';
      } else if (ownRecentAlert) {
        note = 'note_resolve_own_alert';
      } else if (plantCooldown) {
        note = 'note_resolve_cooldown';
      } else {
        base = POINTS.resolve;
        rescue = POINTS.rescueBonus;
      }
      break;
    }
  }

  const raw = applyMultiplier(base, isCommunity) + (rescue > 0 ? rescue : 0);
  const cap = dailyCapFor(ctx.accountCreatedAt, ctx.currentKarma, now);
  const remaining = Math.max(0, cap - ctx.earnedLast24h);
  let points = applyMultiplier(base, isCommunity);
  let rescueBonus = rescue;
  if (raw > remaining) {
    // Trim the main award first, then the rescue bonus.
    points = Math.min(points, remaining);
    rescueBonus = Math.min(rescueBonus, remaining - points);
    if (raw > 0) note = 'note_daily_cap';
  }

  return { kind, points, basePoints: base, rescueBonus, note };
}

/** Points for creating a plant. `earningPlantsLast24h` counts prior EARNING plant_new events. */
export function plantNewPoints(input: {
  earningPlantsLast24h: number;
  accountCreatedAt: Date;
  currentKarma: number;
  earnedLast24h: number;
  now: Date;
}): { points: number; note?: string } {
  const limit = isNewAccount(input.accountCreatedAt, input.currentKarma, input.now)
    ? PLANT_NEW_EARNING_PER_DAY_NEW_ACCOUNT
    : PLANT_NEW_EARNING_PER_DAY;
  if (input.earningPlantsLast24h >= limit) {
    return { points: 0, note: 'note_plant_daily_limit' };
  }
  const cap = dailyCapFor(input.accountCreatedAt, input.currentKarma, input.now);
  const remaining = Math.max(0, cap - input.earnedLast24h);
  return { points: Math.min(POINTS.plantNew, remaining) };
}

/** Retroactive payout to the reporter when a different user resolves their alert. */
/**
 * Karma for a social action.
 *
 * A sibling of computeAward rather than a case inside it: AwardContext demands
 * a plant and a species, computeAward is a total switch over CareActionType,
 * and karma-check.ts builds a full care context in twenty assertions. Adding a
 * 'post' branch would make every one of those carry meaningless plant data.
 *
 * It shares `dailyCapFor` with care actions on purpose. Give social karma its
 * own budget and the economy inverts: an idle poster out-earns a gardener,
 * which is exactly what this file's header exists to prevent.
 */
export function socialAward(input: {
  kind: KarmaKind;
  basePoints: number;
  earnedLast24h: number;
  accountCreatedAt: Date;
  currentKarma: number;
  now: Date;
}): { kind: KarmaKind; points: number; note?: string } {
  const cap = dailyCapFor(input.accountCreatedAt, input.currentKarma, input.now);
  const remaining = Math.max(0, cap - input.earnedLast24h);
  const points = Math.min(input.basePoints, remaining);
  return {
    kind: input.kind,
    points,
    note: points < input.basePoints ? 'note_daily_cap' : undefined,
  };
}

/**
 * How many posts/comments this account may write per hour.
 *
 * The care economy throttles by cooldown per plant; a feed needs a throttle per
 * author, or one account can bury a small zone. Scales with the same trust
 * ladder rather than inventing a second one.
 */
export function postsPerHourFor(karma: number): number {
  return POSTS_PER_HOUR[trustLevelIndex(karma)];
}

export function commentsPerHourFor(karma: number): number {
  return COMMENTS_PER_HOUR[trustLevelIndex(karma)];
}

export function reportConfirmedPoints(reporterId: number, plantFounderId: number): number {
  return applyMultiplier(POINTS.reportConfirmed, plantFounderId !== reporterId);
}

/** Founder bonus eligibility: the plant has proven real. Exempt from daily caps. */
export function plantEstablishedEligible(input: {
  plantVerified: boolean;
  plantAgeDays: number;
  careObservationCount: number;
  distinctCarers: number;
  hasNonFounderCarer: boolean;
}): boolean {
  return (
    input.plantVerified &&
    input.plantAgeDays >= PLANT_ESTABLISHED_MIN_AGE_DAYS &&
    input.careObservationCount >= PLANT_ESTABLISHED_MIN_OBSERVATIONS &&
    input.distinctCarers >= 2 &&
    input.hasNonFounderCarer
  );
}

// ---------------------------------------------------------------------------
// Trust levels & privileges
// ---------------------------------------------------------------------------

export interface TrustLevel {
  level: number;
  name: string;
  minKarma: number;
  adoptionCap: number;
}

export const TRUST_LEVELS: TrustLevel[] = [
  { level: 0, name: 'Seedling', minKarma: 0, adoptionCap: 2 },
  { level: 1, name: 'Sprout', minKarma: 75, adoptionCap: 5 },
  { level: 2, name: 'Gardener', minKarma: 250, adoptionCap: 10 },
  { level: 3, name: 'Caretaker', minKarma: 600, adoptionCap: 15 },
  { level: 4, name: 'Garden Elder', minKarma: 1500, adoptionCap: 25 },
];

export function trustLevelIndex(karma: number): number {
  let index = 0;
  for (let i = 0; i < TRUST_LEVELS.length; i += 1) {
    if (karma >= TRUST_LEVELS[i].minKarma) index = i;
  }
  return index;
}

export function trustLevelFor(karma: number): TrustLevel {
  let current = TRUST_LEVELS[0];
  for (const level of TRUST_LEVELS) {
    if (karma >= level.minKarma) current = level;
  }
  return current;
}

export function nextTrustLevel(karma: number): TrustLevel | null {
  return TRUST_LEVELS.find((l) => l.minKarma > karma) ?? null;
}

export function adoptionCapFor(karma: number): number {
  return trustLevelFor(karma).adoptionCap;
}

export interface PrivilegeContext {
  karma: number;
  isFounder: boolean;
  isActiveSteward: boolean;
}

/** Whose reports flip the plant into a sticky status (anti map-vandalism). */
export function canFlipStatus(ctx: PrivilegeContext): boolean {
  return ctx.isFounder || ctx.isActiveSteward || ctx.karma >= TRUST_LEVELS[1].minKarma;
}

export function canResolve(ctx: PrivilegeContext): boolean {
  return ctx.isFounder || ctx.isActiveSteward || ctx.karma >= TRUST_LEVELS[2].minKarma;
}

export function canEditPlant(ctx: PrivilegeContext & { isSteward: boolean }): boolean {
  if (ctx.isFounder) return true;
  if (ctx.isSteward && ctx.karma >= TRUST_LEVELS[2].minKarma) return true;
  return ctx.karma >= TRUST_LEVELS[3].minKarma;
}

/**
 * Zone moderation reuses the existing trust ladder rather than a second
 * permission system — same shape as canFlipStatus / canResolve above. An
 * explicit zone mod always qualifies; otherwise it takes Caretaker standing.
 */
export function canModerateZone(ctx: { karma: number; isZoneMod: boolean }): boolean {
  return ctx.isZoneMod || ctx.karma >= TRUST_LEVELS[3].minKarma;
}

export function canMarkRemoved(ctx: PrivilegeContext): boolean {
  return ctx.isFounder || ctx.karma >= TRUST_LEVELS[3].minKarma;
}

// ---------------------------------------------------------------------------
// Stewardship & decay (computed at read time, like plant-status)
// ---------------------------------------------------------------------------

export function activityWindowDays(species: { wateringFrequencyDays: number | null }): number {
  const freq = species.wateringFrequencyDays ?? DEFAULT_WATERING_FREQUENCY_DAYS;
  return Math.max(2 * freq, 14);
}

export function isStewardActive(
  input: {
    lastActionAt: Date | null;
    adoptedAt: Date;
    windowDays: number;
  },
  now: Date = new Date()
): boolean {
  const anchor =
    input.lastActionAt && input.lastActionAt > input.adoptedAt
      ? input.lastActionAt
      : input.adoptedAt;
  return daysSince(anchor, now) <= input.windowDays;
}

export function isUpForAdoption(
  plant: {
    status: string;
    plantedAt: Date;
    lastWateredAt: Date | null;
    lastCheckedAt: Date | null;
    careMode?: string | null;
  },
  species: { wateringFrequencyDays: number | null },
  now: Date = new Date()
): boolean {
  if (plant.status === 'removed' || plant.status === 'dormant') return false;
  // A tree that was never yours to water cannot be neglected by you. Without
  // this, every mapped street citrus would advertise itself as abandoned a
  // fortnight after being pinned.
  if (!expectsWatering(plant.careMode)) return false;
  const lastTouch = new Date(
    Math.max(
      plant.plantedAt.getTime(),
      plant.lastWateredAt?.getTime() ?? 0,
      plant.lastCheckedAt?.getTime() ?? 0
    )
  );
  return daysSince(lastTouch, now) > activityWindowDays(species);
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeMetric =
  | 'plantsFounded'
  | 'earningHarvests'
  | 'verifiedHarvests'
  | 'earningWaterDue'
  | 'rescueBonuses'
  | 'goodNeighborEvents'
  | 'adopts'
  | 'reportsConfirmed'
  | 'earningPhotos'
  | 'firstHarvestBonuses'
  | 'karma';

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  metric: BadgeMetric;
  threshold: number;
}

export const BADGES: BadgeDef[] = [
  { id: 'first_sprout', name: 'First Sprout', description: 'Planted your first plant', metric: 'plantsFounded', threshold: 1 },
  { id: 'green_thumb', name: 'Green Thumb', description: 'Planted 10 plants', metric: 'plantsFounded', threshold: 10 },
  { id: 'first_harvest', name: 'First Harvest', description: 'Logged your first harvest', metric: 'earningHarvests', threshold: 1 },
  { id: 'provider', name: 'Provider', description: '10 photo-verified harvests', metric: 'verifiedHarvests', threshold: 10 },
  { id: 'rainmaker', name: 'Rainmaker', description: '50 waterings when plants needed it', metric: 'earningWaterDue', threshold: 50 },
  { id: 'lifesaver', name: 'Lifesaver', description: 'Rescued 5 plants in trouble', metric: 'rescueBonuses', threshold: 5 },
  { id: 'good_neighbor', name: 'Good Neighbor', description: "25 care actions on other people's plants", metric: 'goodNeighborEvents', threshold: 25 },
  { id: 'foster_gardener', name: 'Foster Gardener', description: 'Adopted 5 plants', metric: 'adopts', threshold: 5 },
  { id: 'watchful_eye', name: 'Watchful Eye', description: '10 confirmed problem reports', metric: 'reportsConfirmed', threshold: 10 },
  { id: 'documentarian', name: 'Documentarian', description: '25 photo updates', metric: 'earningPhotos', threshold: 25 },
  { id: 'full_circle', name: 'Full Circle', description: 'A plant you planted fed someone', metric: 'firstHarvestBonuses', threshold: 1 },
  { id: 'garden_elder', name: 'Garden Elder', description: 'Reached 1500 karma', metric: 'karma', threshold: 1500 },
];

/** Which metrics can change after logging an event of the given kind. */
export const KIND_TO_METRICS: Partial<Record<KarmaKind, BadgeMetric[]>> = {
  plant_new: ['plantsFounded'],
  water_due: ['earningWaterDue', 'goodNeighborEvents', 'karma'],
  photo: ['earningPhotos', 'goodNeighborEvents', 'karma'],
  harvest: ['earningHarvests', 'verifiedHarvests', 'goodNeighborEvents', 'karma'],
  resolve: ['goodNeighborEvents', 'karma'],
  report_confirmed: ['reportsConfirmed', 'karma'],
  rescue_bonus: ['rescueBonuses'],
  adopt: ['adopts'],
  plant_first_harvest: ['firstHarvestBonuses', 'karma'],
  plant_established: ['karma'],
};

export function evaluateBadges(
  metrics: Partial<Record<BadgeMetric, number>>,
  currentBadges: string[]
): BadgeDef[] {
  return BADGES.filter(
    (badge) =>
      !currentBadges.includes(badge.id) &&
      (metrics[badge.metric] ?? 0) >= badge.threshold
  );
}

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}
