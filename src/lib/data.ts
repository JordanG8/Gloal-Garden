import { db } from '@/db';
import { adoptions, observations, plants, species, users } from '@/db/schema';
import { and, count, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { computeStatus } from './plant-status';
import { activityWindowDays, isStewardActive, isUpForAdoption } from './karma';
import type { ObservationEntry, PlantSummary, SpeciesOption, StewardEntry } from './types';

const NEW_PLANT_WINDOW_DAYS = 14;

export interface GardenData {
  plants: PlantSummary[];
  speciesList: SpeciesOption[];
  dbReady: boolean;
}

type PlantRow = typeof plants.$inferSelect;
type SpeciesRow = typeof species.$inferSelect;

function toPlantSummary(
  plant: PlantRow,
  sp: SpeciesRow,
  plantedByName: string,
  stewardCount: number
): PlantSummary {
  return {
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
    founderId: plant.plantedBy,
    upForAdoption: isUpForAdoption(plant, sp),
    stewardCount,
    description: plant.description,
    accessNotes: plant.accessNotes,
    wateringFrequencyDays: sp.wateringFrequencyDays,
    daysToHarvest: sp.daysToHarvest,
  };
}

export async function getGardenData(): Promise<GardenData> {
  try {
    const [plantRows, speciesRows, stewardCounts] = await Promise.all([
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
      db
        .select({ plantId: adoptions.plantId, n: count() })
        .from(adoptions)
        .groupBy(adoptions.plantId),
    ]);

    const stewardCountByPlant = new Map(stewardCounts.map((row) => [row.plantId, Number(row.n)]));

    const mapped: PlantSummary[] = plantRows.map(({ plant, species: sp, plantedByName }) =>
      toPlantSummary(plant, sp, plantedByName, stewardCountByPlant.get(plant.id) ?? 0)
    );

    return { plants: mapped, speciesList: speciesRows, dbReady: true };
  } catch (error) {
    console.error('Failed to load garden data (is POSTGRES_URL configured?):', error);
    return { plants: [], speciesList: [], dbReady: false };
  }
}

/** Plant ids the viewer stewards — lets the map panel show Adopt vs. Stop stewarding. */
export async function getViewerAdoptedPlantIds(userId: number): Promise<number[]> {
  try {
    const rows = await db
      .select({ plantId: adoptions.plantId })
      .from(adoptions)
      .where(eq(adoptions.userId, userId));
    return rows.map((row) => row.plantId);
  } catch (error) {
    console.error('Failed to load viewer adoptions:', error);
    return [];
  }
}

export interface PlantDetail {
  plant: PlantSummary;
  observations: ObservationEntry[];
  stewards: StewardEntry[];
  verified: boolean;
}

export async function getPlantDetail(id: number): Promise<PlantDetail | null> {
  try {
    const [rows, logRows, stewardRows, verifiedRows] = await Promise.all([
      db
        .select({ plant: plants, species: species, plantedByName: users.displayName })
        .from(plants)
        .innerJoin(species, eq(plants.speciesId, species.id))
        .innerJoin(users, eq(plants.plantedBy, users.id))
        .where(eq(plants.id, id))
        .limit(1),
      db
        .select({
          id: observations.id,
          type: observations.type,
          caption: observations.caption,
          photoUrl: observations.photoUrl,
          harvestQuantity: observations.harvestQuantity,
          diseaseTag: observations.diseaseTag,
          createdAt: observations.createdAt,
          userName: users.displayName,
        })
        .from(observations)
        .innerJoin(users, eq(observations.userId, users.id))
        .where(eq(observations.plantId, id))
        .orderBy(desc(observations.createdAt))
        .limit(100),
      db
        .select({
          id: users.id,
          name: users.displayName,
          adoptedAt: adoptions.createdAt,
          lastActionAt: sql<string | null>`(
            select max(o.created_at) from observations o
            where o.user_id = ${adoptions.userId} and o.plant_id = ${adoptions.plantId}
          )`,
        })
        .from(adoptions)
        .innerJoin(users, eq(adoptions.userId, users.id))
        .where(eq(adoptions.plantId, id))
        .orderBy(adoptions.createdAt),
      db
        .select({ id: observations.id })
        .from(observations)
        .where(and(eq(observations.plantId, id), isNotNull(observations.photoUrl)))
        .limit(1),
    ]);

    const row = rows[0];
    if (!row) return null;

    const { plant, species: sp, plantedByName } = row;
    const windowDays = activityWindowDays(sp);

    const stewards: StewardEntry[] = stewardRows.map((steward) => ({
      id: steward.id,
      name: steward.name,
      adoptedAt: steward.adoptedAt.toISOString(),
      active: isStewardActive({
        lastActionAt: steward.lastActionAt ? new Date(steward.lastActionAt) : null,
        adoptedAt: steward.adoptedAt,
        windowDays,
      }),
    }));

    return {
      plant: toPlantSummary(plant, sp, plantedByName, stewards.length),
      observations: logRows.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
      stewards,
      verified: verifiedRows.length > 0,
    };
  } catch (error) {
    console.error('Failed to load plant detail:', error);
    return null;
  }
}
