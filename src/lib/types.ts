import type { PlantStatus } from './plant-status';

export interface PlantSummary {
  id: number;
  name: string;
  /** How many physical plants this one pin stands for. 1 for a single tree. */
  quantity: number;
  /** Null for a loose pin — a street tree belongs to nobody's garden. */
  gardenId: number | null;
  bedLabel: string | null;
  lat: number;
  lng: number;
  category: string;
  speciesName: string;
  speciesNameHe: string | null;
  emoji: string;
  scientificName: string;
  /** Set when the planter chose "Other" and typed their own plant name. */
  customSpeciesName: string | null;
  status: PlantStatus;
  isNew: boolean;
  plantedAt: string;
  lastWateredAt: string | null;
  plantedByName: string;
  founderId: number;
  upForAdoption: boolean;
  stewardCount: number;
  description: string | null;
  accessNotes: string | null;
  wateringFrequencyDays: number | null;
  daysToHarvest: number | null;
  latestPhotoUrl: string | null;
  photoCount: number;
}

/**
 * What a pin on the map actually renders, and nothing else.
 *
 * The map used to ship a whole `PlantSummary` per pin — 27 fields, including
 * two timestamps, a description and access notes — to draw a 68px circle with a
 * photo in it. At the pin cap that was ~120 kB of JSON per viewport, most of it
 * never read. These are the fields `plant-marker.tsx` and the search box
 * actually touch; anything else belongs to the plant page, which fetches its
 * own data anyway.
 *
 * Deliberately a separate type rather than a `Pick<PlantSummary>`: it is a wire
 * format for one screen, and it should be free to diverge from the summary the
 * garden and profile pages want.
 */
export interface MapPlant {
  id: number;
  name: string;
  lat: number;
  lng: number;
  /** Drives the fallback pin art when there's no photo. */
  category: string;
  emoji: string;
  /** All four feed the search box's matching and subtitle. */
  speciesName: string;
  speciesNameHe: string | null;
  scientificName: string;
  customSpeciesName: string | null;
  plantedByName: string;
  status: PlantStatus;
  /** With `status`, decides which badge the pin wears. */
  upForAdoption: boolean;
  latestPhotoUrl: string | null;
}

export interface ObservationEntry {
  id: number;
  type: string;
  userId: number;
  userAvatar: string | null;
  points: number;
  caption: string | null;
  photoUrl: string | null;
  harvestQuantity: string | null;
  diseaseTag: string | null;
  createdAt: string;
  userName: string;
}

export interface SessionUser {
  id: number;
  name: string;
  avatar: string | null;
  karma: number;
  trustLevel: number;
  emailVerified: boolean;
  /** True when email delivery is configured and this account is unverified. */
  verificationRequired: boolean;
}

export interface StewardEntry {
  id: number;
  name: string;
  avatar: string | null;
  active: boolean;
  adoptedAt: string;
}

export interface UserProfile {
  id: number;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  createdAt: string;
  karma: number;
  karma7d: number;
  badges: string[];
  stats: {
    plantsFounded: number;
    harvests: number;
    verifiedHarvests: number;
    waterings: number;
    photos: number;
    rescues: number;
  };
  stewardships: {
    plantId: number;
    plantName: string;
    category: string;
    active: boolean;
    adoptedAt: string;
  }[];
  recentEvents: {
    id: number;
    kind: string;
    points: number;
    plantId: number | null;
    plantName: string | null;
    createdAt: string;
  }[];
}

export interface LeaderboardRow {
  id: number;
  displayName: string;
  avatar: string | null;
  karma: number;
  karma7d: number;
  badges: string[];
}

export interface KarmaBreakdown {
  kind: string;
  base: number;
  communityBonus: number;
  rescueBonus: number;
  isCommunity: boolean;
  totalKarma: number;
}

export type ActionResult =
  | { ok: true; pointsAwarded?: number; newBadges?: string[]; note?: string; breakdown?: KarmaBreakdown }
  | { ok: false; error: string };
