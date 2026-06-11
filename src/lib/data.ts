import { db } from '@/db';
import { plants, species, users } from '@/db/schema';
import { eq, ne } from 'drizzle-orm';
import { computeStatus } from './plant-status';
import type { PlantSummary, SpeciesOption } from './types';

const NEW_PLANT_WINDOW_DAYS = 14;

export interface GardenData {
  plants: PlantSummary[];
  speciesList: SpeciesOption[];
  dbReady: boolean;
}

export async function getGardenData(): Promise<GardenData> {
  try {
    const [plantRows, speciesRows] = await Promise.all([
      db
        .select({
          plant: plants,
          species: species,
          plantedByName: users.displayName,
        })
        .from(plants)
        .innerJoin(species, eq(plants.speciesId, species.id))
        .innerJoin(users, eq(plants.plantedBy, users.id))
        .where(ne(plants.status, 'removed')),
      db
        .select({
          id: species.id,
          commonName: species.commonName,
          emoji: species.emoji,
          category: species.category,
        })
        .from(species)
        .orderBy(species.commonName),
    ]);

    const mapped: PlantSummary[] = plantRows.map(({ plant, species: sp, plantedByName }) => ({
      id: plant.id,
      name: plant.nickname || sp.commonName,
      lat: plant.lat,
      lng: plant.lng,
      emoji: sp.emoji,
      category: sp.category,
      speciesName: sp.commonName,
      scientificName: sp.scientificName,
      status: computeStatus(plant, sp),
      isNew:
        Date.now() - new Date(plant.plantedAt).getTime() <
        NEW_PLANT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      plantedAt: plant.plantedAt.toISOString(),
      lastWateredAt: plant.lastWateredAt?.toISOString() ?? null,
      plantedByName,
      description: plant.description,
      accessNotes: plant.accessNotes,
      wateringFrequencyDays: sp.wateringFrequencyDays,
      daysToHarvest: sp.daysToHarvest,
    }));

    return { plants: mapped, speciesList: speciesRows, dbReady: true };
  } catch (error) {
    console.error('Failed to load garden data (is POSTGRES_URL configured?):', error);
    return { plants: [], speciesList: [], dbReady: false };
  }
}
