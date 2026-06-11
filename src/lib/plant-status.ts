export type PlantStatus =
  | 'growing'
  | 'needs_water'
  | 'needs_attention'
  | 'ready_to_harvest'
  | 'diseased'
  | 'dormant'
  | 'removed';

// Statuses that are set explicitly (e.g. by a report) and stay until resolved,
// rather than being derived from watering/harvest timing.
const STICKY_STATUSES: PlantStatus[] = ['needs_attention', 'diseased', 'dormant', 'removed'];

interface StatusPlantInput {
  status: string;
  plantedAt: Date | string;
  lastWateredAt: Date | string | null;
}

interface StatusSpeciesInput {
  daysToHarvest: number | null;
  wateringFrequencyDays: number | null;
}

function daysSince(date: Date | string): number {
  const diffMs = Date.now() - new Date(date).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function computeStatus(plant: StatusPlantInput, speciesInfo: StatusSpeciesInput): PlantStatus {
  if (STICKY_STATUSES.includes(plant.status as PlantStatus)) {
    return plant.status as PlantStatus;
  }

  if (speciesInfo.daysToHarvest) {
    const age = daysSince(plant.plantedAt);
    if (age >= speciesInfo.daysToHarvest - 7 && age <= speciesInfo.daysToHarvest + 7) {
      return 'ready_to_harvest';
    }
  }

  if (speciesInfo.wateringFrequencyDays) {
    const lastWatered = plant.lastWateredAt ?? plant.plantedAt;
    if (daysSince(lastWatered) > speciesInfo.wateringFrequencyDays) {
      return 'needs_water';
    }
  }

  return 'growing';
}
