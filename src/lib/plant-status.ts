import { sql } from 'drizzle-orm';
import { plants, species } from '@/db/schema';

export type PlantStatus = 'growing' | 'needs_water' | 'needs_attention' | 'ready_to_harvest' | 'diseased' | 'dormant' | 'removed';

export function computeStatus(plant: any, speciesInfo: any): PlantStatus {
  if (plant.status === 'diseased' || plant.status === 'removed' || plant.status === 'dormant') {
    return plant.status;
  }

  const now = new Date();
  
  if (plant.plantedAt && speciesInfo.daysToHarvest) {
    const plantedDate = new Date(plant.plantedAt);
    const diffTime = Math.abs(now.getTime() - plantedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (Math.abs(diffDays - speciesInfo.daysToHarvest) <= 7) {
      return 'ready_to_harvest';
    }
  }

  if (speciesInfo.wateringFrequencyDays) {
    const lastWatered = plant.lastWateredAt ? new Date(plant.lastWateredAt) : new Date(plant.plantedAt);
    const diffTime = Math.abs(now.getTime() - lastWatered.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > speciesInfo.wateringFrequencyDays) {
      return 'needs_water';
    }
  }

  return 'growing';
}

export const computedStatusSql = sql`
  CASE 
    WHEN ${plants.status} IN ('diseased', 'removed', 'dormant') THEN ${plants.status}
    WHEN ${plants.plantedAt} IS NOT NULL AND ${species.daysToHarvest} IS NOT NULL 
         AND ABS(EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ${plants.plantedAt}))) >= (${species.daysToHarvest} - 7)
         AND ABS(EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ${plants.plantedAt}))) <= (${species.daysToHarvest} + 7)
    THEN 'ready_to_harvest'
    WHEN ${species.wateringFrequencyDays} IS NOT NULL 
         AND EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(${plants.lastWateredAt}, ${plants.plantedAt}))) > ${species.wateringFrequencyDays}
    THEN 'needs_water'
    ELSE 'growing'
  END
`;
