import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
  json,
  primaryKey
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
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
});

export const species = pgTable('species', {
  id: serial('id').primaryKey(),
  commonName: text('common_name').notNull(),
  scientificName: text('scientific_name').notNull(),
  category: text('category').notNull(), // 'vegetable' | 'fruit' | 'herb' | 'tree'
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
});

export const plants = pgTable('plants', {
  id: serial('id').primaryKey(),
  speciesId: integer('species_id').references(() => species.id).notNull(),
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
});

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
});

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
  primaryKey({ columns: [t.userId, t.plantId] })
]);

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),
  payload: json('payload'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
