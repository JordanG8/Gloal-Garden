import { sql } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
  json,
  point,
  primaryKey,
  index,
  uniqueIndex,
  type AnyPgColumn
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestamp('email_verified_at'),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  avatar: text('avatar'),
  bio: text('bio'),
  location: text('location'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  stats: json('stats').$type<{
    plantsAdded: number;
    photosContributed: number;
    careActions: number;
    harvestsLogged: number;
  }>().default({
    plantsAdded: 0,
    photosContributed: 0,
    careActions: 0,
    harvestsLogged: 0
  }),
  badges: json('badges').$type<string[]>().default([]),
  // Denormalized display value; the karma_events ledger is the source of truth.
  karma: integer('karma').notNull().default(0),
}, (t) => [
  index('users_karma_idx').on(t.karma),
]);

export const species = pgTable('species', {
  id: serial('id').primaryKey(),
  commonName: text('common_name').notNull(),
  commonNameHe: text('common_name_he'),
  scientificName: text('scientific_name').notNull(),
  category: text('category').notNull(), // 'vegetable' | 'fruit' | 'herb' | 'tree'
  emoji: text('emoji').notNull().default('🌱'),
  growingSeasonStart: integer('growing_season_start'),
  growingSeasonEnd: integer('growing_season_end'),
  daysToHarvest: integer('days_to_harvest'),
  wateringFrequencyDays: integer('watering_frequency_days').notNull(),
  sunRequirements: text('sun_requirements'),
  soilNotes: text('soil_notes'),
  hardinessZones: text('hardiness_zones'),
  companionPlants: text('companion_plants'),
  careGuideMarkdown: text('care_guide_markdown'),
  heroImageUrl: text('hero_image_url'),
  // A tree fruits on the calendar, not on a countdown from planting: a mature
  // lemon crops every winter regardless of when it went in the ground.
  // `days_to_harvest` stays for annuals (and because dropping a column other
  // deployed code still reads would break a rolling deploy).
  isPerennial: integer('is_perennial').notNull().default(0),
  harvestMonthStart: integer('harvest_month_start'), // 1-12
  harvestMonthEnd: integer('harvest_month_end'),     // inclusive, may wrap the year
  yearsToFirstHarvest: integer('years_to_first_harvest'),
  // Mediterranean climates need two cadences, not one. A winter interval of 0
  // means "the rain handles it".
  waterIntervalSummerDays: integer('water_interval_summer_days'),
  waterIntervalWinterDays: integer('water_interval_winter_days'),
});

export const plants = pgTable('plants', {
  id: serial('id').primaryKey(),
  speciesId: integer('species_id').references(() => species.id).notNull(),
  // Set when the planter picked "Other" and typed their own name instead of
  // choosing from the species list; speciesId still points at the generic
  // CUSTOM_SPECIES_MARKER row so care-cadence defaults (watering, etc.) work.
  customSpeciesName: text('custom_species_name'),
  nickname: text('nickname'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  plantedAt: timestamp('planted_at').defaultNow().notNull(),
  plantedBy: integer('planted_by').references(() => users.id).notNull(),
  status: text('status').notNull().default('growing'),
  lastWateredAt: timestamp('last_watered_at'),
  lastCheckedAt: timestamp('last_checked_at'),
  expectedHarvestAt: timestamp('expected_harvest_at'),
  description: text('description'),
  accessNotes: text('access_notes'),
  visibility: text('visibility').notNull().default('public'),
  // One pin can stand for a row of plants ("12 basil"). Karma is deliberately
  // per-pin regardless of this number — see karma.ts. Display only.
  quantity: integer('quantity').notNull().default(1),
  // Nullable on purpose: a street tree belongs to nobody's garden.
  gardenId: integer('garden_id').references((): AnyPgColumn => gardens.id),
  // A plain label rather than a `beds` table — a bed has a name and an order
  // and no behaviour of its own, so a table would be a primary key wrapped
  // around a string. "Water this bed" is `where garden_id = ? and bed_label = ?`.
  bedLabel: text('bed_label'),

  // How this plant came to be here. The app assumed you had just planted
  // everything, which is wrong for most of what people will actually map:
  // established citrus leaning over a wall into the street.
  //   planted_by_me  you put it in the ground
  //   already_there  it predates you — someone else's tree, or the street's
  //   wild           self-seeded, nobody planted it
  //   inherited      you took over an existing garden
  origin: text('origin').notNull().default('planted_by_me'),
  // How much `planted_at` should be trusted: 'day' | 'month' | 'year' | 'unknown'.
  // "Sometime in the nineties" is a real answer for a mature tree.
  plantedAtPrecision: text('planted_at_precision').notNull().default('day'),

  // What kind of care this plant expects.
  //   scheduled     you water it on a cadence
  //   rain_fed      established; rain handles it, but flag a drought
  //   observe_only  not yours to water — log fruit and health, nothing else
  careMode: text('care_mode').notNull().default('scheduled'),
  // Per-plant overrides of the species cadence, for a tree in unusual sun or
  // a pot that dries out faster than the ground.
  waterIntervalSummerDays: integer('water_interval_summer_days'),
  waterIntervalWinterDays: integer('water_interval_winter_days'),
  // Materialized on every care write so "what needs water?" is an indexed
  // range scan rather than logic that has to be re-derived per row. Null for
  // observe_only plants, which are never due.
  waterDueAt: timestamp('water_due_at'),
  // Denormalized from observations. The map read used to run two correlated
  // subqueries per plant for these, which is fine at 11 plants and fatal at
  // thousands. Maintained in the same runBatch that inserts an observation.
  latestPhotoUrl: text('latest_photo_url'),
  photoCount: integer('photo_count').notNull().default(0),
  // lat/lng stay the source of truth; this is a derived index target. Native
  // Postgres `point` + GiST answers every v1 spatial query (viewport bbox via
  // `<@ box`, nearest via `<->`) with no PostGIS extension. Note the argument
  // order: point(x, y) is point(lng, lat).
  geo: point('geo', { mode: 'xy' }).generatedAlwaysAs(sql`point(lng, lat)`),
}, (t) => [
  // "My garden" and public profiles filter by founder.
  index('plants_planted_by_idx').on(t.plantedBy),
  // Every map/garden read joins species; the table is small but the join is hot.
  index('plants_species_idx').on(t.speciesId),
  // Viewport queries: `where geo <@ box(point(minLng,minLat), point(maxLng,maxLat))`.
  index('plants_geo_gist_idx').using('gist', t.geo),
  // Listing a garden, and the batch-care "everything in this bed" read.
  index('plants_garden_bed_idx').on(t.gardenId, t.bedLabel),
  // "What's thirsty?" — the daily sweep and the map's water filter. Partial,
  // because plants nobody waters are the majority of what gets mapped and
  // there's no reason to index them.
  index('plants_water_due_idx')
    .on(t.waterDueAt)
    .where(sql`water_due_at is not null`),
]);

/**
 * A physical place holding several plants: a raised bed, a back garden, a
 * community plot. Deliberately *not* required — a lemon tree leaning over a
 * street wall is a bare pin with `garden_id = null`, and forcing it into a
 * container would be a lie about the world.
 *
 * `kind` is the scale, and mostly drives presentation:
 *   patch      a few plants in one spot
 *   plot       a whole garden, usually with beds
 *   community  a shared plot with members and roles
 */
export const gardens = pgTable('gardens', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  kind: text('kind').notNull().default('patch'),
  description: text('description'),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  // Centre of the garden, used to place its marker at cluster zoom.
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  geo: point('geo', { mode: 'xy' }).generatedAlwaysAs(sql`point(lng, lat)`),
  // Rough extent in metres, so the map can draw it and "is this plant inside?"
  // has an answer without asking the user to trace a polygon.
  radiusM: integer('radius_m').notNull().default(25),
  visibility: text('visibility').notNull().default('public'),
  // Denormalized: the map draws one marker per garden with its count on it,
  // and counting plants per garden on every pan would defeat the purpose.
  plantCount: integer('plant_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('gardens_owner_idx').on(t.ownerId),
  index('gardens_geo_gist_idx').using('gist', t.geo),
]);

/**
 * Who may tend a community garden. Solo and patch gardens don't need rows
 * here — the owner is `gardens.owner_id`.
 */
export const gardenMembers = pgTable('garden_members', {
  gardenId: integer('garden_id').references(() => gardens.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  role: text('role').notNull().default('member'), // 'member' | 'keeper'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.gardenId, t.userId] }),
  index('garden_members_user_idx').on(t.userId),
]);

export const observations = pgTable('observations', {
  id: serial('id').primaryKey(),
  plantId: integer('plant_id').references(() => plants.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),
  photoUrl: text('photo_url'),
  caption: text('caption'),
  harvestQuantity: text('harvest_quantity'),
  diseaseTag: text('disease_tag'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  // Matches the plant activity feed's ORDER BY exactly (data.ts getPlantDetail).
  index('observations_plant_created_idx').on(t.plantId, t.createdAt.desc(), t.id.desc()),
  // Steward "last action on this plant" lookup.
  index('observations_user_plant_idx').on(t.userId, t.plantId),
  // Latest-photo lookup: the subquery always adds `photo_url is not null`, so a
  // partial index keeps it to the rows that can actually answer it.
  index('observations_plant_photo_idx')
    .on(t.plantId, t.createdAt.desc())
    .where(sql`photo_url is not null`),
]);

export const follows = pgTable('follows', {
  followerId: integer('follower_id').references(() => users.id).notNull(),
  followingId: integer('following_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.followerId, t.followingId] })
]);

export const adoptions = pgTable('adoptions', {
  userId: integer('user_id').references(() => users.id).notNull(),
  plantId: integer('plant_id').references(() => plants.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.plantId] }),
  // The PK is user-first, so every "who stewards this plant?" read (steward
  // counts on the map, the steward list on a plant page) was a seq scan.
  index('adoptions_plant_idx').on(t.plantId),
]);

// Append-only karma ledger. Zero-point rows are inserted on purpose (they act
// as cooldown markers and honest history); negative rows are allowed for
// moderation reversals. users.karma is the denormalized running total.
export const karmaEvents = pgTable('karma_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  plantId: integer('plant_id').references(() => plants.id),
  observationId: integer('observation_id').references(() => observations.id),
  kind: text('kind').notNull(),
  points: integer('points').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('karma_events_user_created_idx').on(t.userId, t.createdAt),
  index('karma_events_plant_kind_idx').on(t.plantId, t.kind),
  // Founder bonuses are once-per-plant; the partial unique index makes the
  // "has this already been paid?" check race-proof (insert onConflictDoNothing).
  uniqueIndex('karma_events_once_per_plant_idx')
    .on(t.plantId, t.kind)
    .where(sql`${t.kind} in ('plant_established', 'plant_first_harvest')`),
  // Per-observation point totals are read for every row of every activity feed.
  index('karma_events_observation_idx').on(t.observationId),
]);

// Single-use, expiring tokens for email verification and password resets.
// Only the sha256 hash is stored; the raw token lives exclusively in the
// emailed link, so a leaked table can't be replayed.
export const authTokens = pgTable('auth_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  type: text('type').notNull(), // 'email_verify' | 'password_reset'
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('auth_tokens_user_type_idx').on(t.userId, t.type),
]);

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),
  payload: json('payload'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
