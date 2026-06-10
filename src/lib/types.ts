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
}

export interface SessionUser {
  id: number;
  name: string;
}

export type ActionResult = { ok: true } | { ok: false; error: string };
