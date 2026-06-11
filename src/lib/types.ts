import type { PlantStatus } from './plant-status';

export interface PlantSummary {
  id: number;
  name: string;
  lat: number;
  lng: number;
  emoji: string;
  category: string;
  speciesName: string;
  scientificName: string;
  status: PlantStatus;
  isNew: boolean;
  plantedAt: string;
  lastWateredAt: string | null;
  plantedByName: string;
  plantedById: number;
  description: string | null;
  accessNotes: string | null;
  wateringFrequencyDays: number | null;
  daysToHarvest: number | null;
}

export interface SpeciesOption {
  id: number;
  commonName: string;
  emoji: string;
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
  userId: number;
}

export interface FeedEntry extends ObservationEntry {
  plantId: number;
  plantName: string | null;
  plantEmoji: string;
  plantSpecies: string;
}

export interface UserStats {
  plantsAdded: number;
  photosContributed: number;
  careActions: number;
  harvestsLogged: number;
}

export interface GardenerProfile {
  id: number;
  displayName: string;
  bio: string | null;
  location: string | null;
  avatar: string | null;
  joinedAt: string;
  stats: UserStats;
  badges: string[];
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  plants: { id: number; name: string; emoji: string; status: string }[];
  adoptedPlants: { id: number; name: string; emoji: string; status: string }[];
  recentActivity: FeedEntry[];
}

export interface SessionUser {
  id: number;
  name: string;
}

export type ActionResult = { ok: true } | { ok: false; error: string };
