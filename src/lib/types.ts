import type { PlantStatus } from './plant-status';

export interface PlantSummary {
  id: number;
  name: string;
  lat: number;
  lng: number;
  category: string;
  speciesName: string;
  scientificName: string;
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
}

export interface SpeciesOption {
  id: number;
  commonName: string;
  category: string;
}

export interface ObservationEntry {
  id: number;
  type: string;
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
  karma: number;
  trustLevel: number;
  emailVerified: boolean;
  /** True when email delivery is configured and this account is unverified. */
  verificationRequired: boolean;
}

export interface StewardEntry {
  id: number;
  name: string;
  active: boolean;
  adoptedAt: string;
}

export interface UserProfile {
  id: number;
  displayName: string;
  bio: string | null;
  location: string | null;
  createdAt: string;
  karma: number;
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
  karma: number;
  karma7d: number;
  badges: string[];
}

export type ActionResult =
  | { ok: true; pointsAwarded?: number; newBadges?: string[]; note?: string }
  | { ok: false; error: string };
