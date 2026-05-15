import { db } from '../src/db';
import { species, plants, users } from '../src/db/schema';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('Seeding data...');
  const [user1] = await db.insert(users).values({
    email: 'test@example.com',
    passwordHash: 'dummy_hash',
    displayName: 'Test Gardener',
  }).returning();

  const insertedSpecies = await db.insert(species).values([
    {
      commonName: 'Tomato (Cherry)',
      scientificName: 'Solanum lycopersicum',
      category: 'vegetable',
      daysToHarvest: 60,
      wateringFrequencyDays: 2,
    },
    {
      commonName: 'Lemon Tree',
      scientificName: 'Citrus limon',
      category: 'fruit',
      daysToHarvest: 365,
      wateringFrequencyDays: 7,
    },
    {
      commonName: 'Basil',
      scientificName: 'Ocimum basilicum',
      category: 'herb',
      daysToHarvest: 30,
      wateringFrequencyDays: 3,
    }
  ]).returning();

  await db.insert(plants).values([
    {
      speciesId: insertedSpecies[0].id,
      lat: 34.0522,
      lng: -118.2437,
      plantedBy: user1.id,
      nickname: 'Downtown Cherry Tomatoes',
      lastWateredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      speciesId: insertedSpecies[1].id,
      lat: 34.0530,
      lng: -118.2450,
      plantedBy: user1.id,
      nickname: 'Plaza Lemon Tree',
      plantedAt: new Date(Date.now() - 360 * 24 * 60 * 60 * 1000),
    }
  ]);
  
  console.log('Seeding complete.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
