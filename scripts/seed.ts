import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/db';
import { species, plants, users, observations } from '../src/db/schema';
import bcrypt from 'bcryptjs';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL is not set. Add it to .env before seeding.');
    process.exit(1);
  }

  console.log('Seeding Global Garden…');

  const passwordHash = await bcrypt.hash('garden123', 10);
  const insertedUsers = await db
    .insert(users)
    .values([
      { email: 'demo@globalgarden.app', passwordHash, displayName: 'Demo Gardener' },
      { email: 'alex@globalgarden.app', passwordHash, displayName: 'Alex T.' },
      { email: 'sam@globalgarden.app', passwordHash, displayName: 'Sam R.' },
    ])
    .returning();
  const [demo, alex, sam] = insertedUsers;

  const insertedSpecies = await db
    .insert(species)
    .values([
      { commonName: 'Cherry Tomato', scientificName: 'Solanum lycopersicum', category: 'vegetable', emoji: '🍅', daysToHarvest: 60, wateringFrequencyDays: 2, sunRequirements: 'Full sun' },
      { commonName: 'Lemon Tree', scientificName: 'Citrus limon', category: 'fruit', emoji: '🍋', daysToHarvest: 365, wateringFrequencyDays: 7, sunRequirements: 'Full sun' },
      { commonName: 'Sweet Basil', scientificName: 'Ocimum basilicum', category: 'herb', emoji: '🌿', daysToHarvest: 30, wateringFrequencyDays: 3, sunRequirements: 'Full to partial sun' },
      { commonName: 'Carrot', scientificName: 'Daucus carota', category: 'vegetable', emoji: '🥕', daysToHarvest: 75, wateringFrequencyDays: 3, sunRequirements: 'Full sun' },
      { commonName: 'Apple Tree', scientificName: 'Malus domestica', category: 'tree', emoji: '🍎', daysToHarvest: 730, wateringFrequencyDays: 10, sunRequirements: 'Full sun' },
      { commonName: 'Jalapeño', scientificName: 'Capsicum annuum', category: 'vegetable', emoji: '🌶️', daysToHarvest: 75, wateringFrequencyDays: 2, sunRequirements: 'Full sun' },
      { commonName: 'Strawberry', scientificName: 'Fragaria × ananassa', category: 'fruit', emoji: '🍓', daysToHarvest: 90, wateringFrequencyDays: 2, sunRequirements: 'Full sun' },
      { commonName: 'Rosemary', scientificName: 'Salvia rosmarinus', category: 'herb', emoji: '🪴', daysToHarvest: 80, wateringFrequencyDays: 14, sunRequirements: 'Full sun, drought tolerant' },
      { commonName: 'Zucchini', scientificName: 'Cucurbita pepo', category: 'vegetable', emoji: '🥒', daysToHarvest: 50, wateringFrequencyDays: 2, sunRequirements: 'Full sun' },
      { commonName: 'Mint', scientificName: 'Mentha spicata', category: 'herb', emoji: '🌱', daysToHarvest: 40, wateringFrequencyDays: 3, sunRequirements: 'Partial shade ok' },
    ])
    .returning();

  const sp = Object.fromEntries(insertedSpecies.map((s) => [s.commonName, s]));

  // Downtown LA cluster with a mix of statuses.
  const insertedPlants = await db
    .insert(plants)
    .values([
      // Healthy, recently watered
      { speciesId: sp['Sweet Basil'].id, nickname: 'Library Steps Basil', lat: 34.0505, lng: -118.2551, plantedBy: demo.id, plantedAt: daysAgo(12), lastWateredAt: daysAgo(1), accessNotes: 'Planter box by the south entrance' },
      // Needs water (watered 5 days ago, frequency 2)
      { speciesId: sp['Cherry Tomato'].id, nickname: 'Alley Tomatoes', lat: 34.0481, lng: -118.2495, plantedBy: alex.id, plantedAt: daysAgo(35), lastWateredAt: daysAgo(5), description: 'Volunteer plant doing surprisingly well.', accessNotes: 'Behind the mural, next to the drain pipe' },
      // Ready to harvest (~60 days old)
      { speciesId: sp['Cherry Tomato'].id, nickname: 'Plaza Cherry Toms', lat: 34.0522, lng: -118.2437, plantedBy: demo.id, plantedAt: daysAgo(58), lastWateredAt: daysAgo(1), description: 'Planted for the community fridge.' },
      // Reported issue
      { speciesId: sp['Strawberry'].id, nickname: 'Parklet Strawberries', lat: 34.0468, lng: -118.2412, plantedBy: sam.id, plantedAt: daysAgo(40), lastWateredAt: daysAgo(2), status: 'diseased', accessNotes: 'Raised bed in the 4th St parklet' },
      // Mature tree
      { speciesId: sp['Lemon Tree'].id, nickname: 'Courthouse Lemon', lat: 34.0556, lng: -118.2426, plantedBy: alex.id, plantedAt: daysAgo(400), lastWateredAt: daysAgo(3), description: 'Anyone can pick — please leave some for others.' },
      // Fresh planting
      { speciesId: sp['Mint'].id, nickname: 'Bus Stop Mint', lat: 34.0497, lng: -118.2392, plantedBy: sam.id, plantedAt: daysAgo(3), lastWateredAt: daysAgo(0), accessNotes: 'Sidewalk strip, NE corner' },
      { speciesId: sp['Jalapeño'].id, nickname: 'Spice Corner', lat: 34.0539, lng: -118.2486, plantedBy: demo.id, plantedAt: daysAgo(20), lastWateredAt: daysAgo(1) },
      { speciesId: sp['Rosemary'].id, nickname: 'Stairway Rosemary', lat: 34.0461, lng: -118.2528, plantedBy: alex.id, plantedAt: daysAgo(120), lastWateredAt: daysAgo(6), description: 'Hardy bush, take cuttings freely.' },
      { speciesId: sp['Zucchini'].id, nickname: 'Vacant Lot Zukes', lat: 34.0573, lng: -118.2467, plantedBy: sam.id, plantedAt: daysAgo(48), lastWateredAt: daysAgo(1) },
      { speciesId: sp['Carrot'].id, nickname: 'Median Carrots', lat: 34.0512, lng: -118.2589, plantedBy: demo.id, plantedAt: daysAgo(70), lastWateredAt: daysAgo(4) },
    ])
    .returning();

  await db.insert(observations).values([
    { plantId: insertedPlants[1].id, userId: alex.id, type: 'water', caption: 'Looking a bit dry but perking up!', createdAt: daysAgo(5) },
    { plantId: insertedPlants[2].id, userId: demo.id, type: 'photo', caption: 'First blossoms are showing.', createdAt: daysAgo(20) },
    { plantId: insertedPlants[2].id, userId: sam.id, type: 'water', createdAt: daysAgo(1) },
    { plantId: insertedPlants[3].id, userId: sam.id, type: 'alert', caption: 'Aphids on the lower leaves, needs neem oil.', diseaseTag: 'pests', createdAt: daysAgo(2) },
    { plantId: insertedPlants[4].id, userId: alex.id, type: 'harvest', caption: 'Took 3 ripe ones, left plenty.', harvestQuantity: '3 lemons', createdAt: daysAgo(4) },
    { plantId: insertedPlants[5].id, userId: sam.id, type: 'photo', caption: 'Freshly planted, fingers crossed.', createdAt: daysAgo(3) },
  ]);

  console.log(`Seeded ${insertedUsers.length} users, ${insertedSpecies.length} species, ${insertedPlants.length} plants.`);
  console.log('Demo login: demo@globalgarden.app / garden123');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
