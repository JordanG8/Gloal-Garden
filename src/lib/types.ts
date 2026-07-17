import type { PlantStatus } from './plant-status';

export interface PlantSummary {
  id: number;
  name: string;
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

export interface SpeciesOption {
  id: number;
  commonName: string;
  commonNameHe: string | null;
  category: string;
  emoji: string;
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
