import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/db';
import { species, plants, users, observations, adoptions, karmaEvents } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import {
  computeAward,
  evaluateBadges,
  plantEstablishedEligible,
  plantNewPoints,
  reportConfirmedPoints,
  POINTS,
  type BadgeMetric,
  type CareActionType,
  type KarmaKind,
} from '../src/lib/karma';
import { computeStatus } from '../src/lib/plant-status';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function main() {
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    console.error('POSTGRES_URL (or DATABASE_URL) is not set. Add it to .env before seeding.');
    process.exit(1);
  }

  console.log('Seeding Global Garden…');

  const passwordHash = await bcrypt.hash('garden123', 10);
  const insertedUsers = await db
    .insert(users)
    .values([
      { email: 'demo@globalgarden.app', passwordHash, displayName: 'Demo Gardener', createdAt: daysAgo(200) },
      { email: 'alex@globalgarden.app', passwordHash, displayName: 'Alex T.', createdAt: daysAgo(180) },
      { email: 'sam@globalgarden.app', passwordHash, displayName: 'Sam R.', createdAt: daysAgo(150) },
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

  // Givat Ada cluster around עדה"ס (HaZayit 33) with a mix of statuses.
  const insertedPlants = await db
    .insert(plants)
    .values([
      // 0: Healthy, recently watered
      { speciesId: sp['Sweet Basil'].id, nickname: 'Library Steps Basil', lat: 32.51920, lng: 35.00310, plantedBy: demo.id, plantedAt: daysAgo(12), lastWateredAt: daysAgo(1), accessNotes: 'Planter box by the south entrance' },
      // 1: Needs water (watered 5 days ago, frequency 2)
      { speciesId: sp['Cherry Tomato'].id, nickname: 'Alley Tomatoes', lat: 32.51760, lng: 35.00580, plantedBy: alex.id, plantedAt: daysAgo(35), lastWateredAt: daysAgo(5), description: 'Volunteer plant doing surprisingly well.', accessNotes: 'Behind the mural, next to the drain pipe' },
      // 2: Ready to harvest (~60 days old)
      { speciesId: sp['Cherry Tomato'].id, nickname: 'Plaza Cherry Toms', lat: 32.51840, lng: 35.00475, plantedBy: demo.id, plantedAt: daysAgo(58), lastWateredAt: daysAgo(1), description: 'Planted for the community fridge.' },
      // 3: Reported issue
      { speciesId: sp['Strawberry'].id, nickname: 'Parklet Strawberries', lat: 32.51690, lng: 35.00390, plantedBy: sam.id, plantedAt: daysAgo(40), lastWateredAt: daysAgo(2), status: 'diseased', accessNotes: 'Raised bed in the 4th St parklet' },
      // 4: Mature tree
      { speciesId: sp['Lemon Tree'].id, nickname: 'Courthouse Lemon', lat: 32.52010, lng: 35.00520, plantedBy: alex.id, plantedAt: daysAgo(400), lastWateredAt: daysAgo(3), description: 'Anyone can pick — please leave some for others.' },
      // 5: Fresh planting
      { speciesId: sp['Mint'].id, nickname: 'Bus Stop Mint', lat: 32.51730, lng: 35.00700, plantedBy: sam.id, plantedAt: daysAgo(3), lastWateredAt: daysAgo(0), accessNotes: 'Sidewalk strip, NE corner' },
      // 6
      { speciesId: sp['Jalapeño'].id, nickname: 'Spice Corner', lat: 32.51960, lng: 35.00150, plantedBy: demo.id, plantedAt: daysAgo(20), lastWateredAt: daysAgo(1) },
      // 7: Neglected past its activity window (14d freq → 28d window) → up for adoption
      { speciesId: sp['Rosemary'].id, nickname: 'Stairway Rosemary', lat: 32.51600, lng: 35.00250, plantedBy: alex.id, plantedAt: daysAgo(120), lastWateredAt: daysAgo(35), description: 'Hardy bush, take cuttings freely.' },
      // 8
      { speciesId: sp['Zucchini'].id, nickname: 'Vacant Lot Zukes', lat: 32.52080, lng: 35.00330, plantedBy: sam.id, plantedAt: daysAgo(48), lastWateredAt: daysAgo(1) },
      // 9: Never photographed → demoably "unverified"
      { speciesId: sp['Carrot'].id, nickname: 'Median Carrots', lat: 32.51870, lng: 35.00050, plantedBy: demo.id, plantedAt: daysAgo(70), lastWateredAt: daysAgo(4) },
    ])
    .returning();

  const photo = (seedName: string) => `https://picsum.photos/seed/${seedName}/800/600`;

  // Chronological care history. Types here are the ACTION types; 'report'
  // becomes an 'alert' observation like the app does.
  const careLog: {
    plantIdx: number;
    userId: number;
    type: CareActionType;
    caption?: string;
    photoUrl?: string;
    harvestQuantity?: string;
    diseaseTag?: string;
    at: Date;
  }[] = [
    { plantIdx: 2, userId: demo.id, type: 'photo', caption: 'First blossoms are showing.', photoUrl: photo('plaza-toms'), at: daysAgo(20) },
    { plantIdx: 8, userId: demo.id, type: 'report', caption: 'Leaves chewed up, maybe slugs?', at: daysAgo(6) },
    { plantIdx: 1, userId: alex.id, type: 'water', caption: 'Looking a bit dry but perking up!', at: daysAgo(5) },
    { plantIdx: 8, userId: alex.id, type: 'resolve', caption: 'Picked the slugs off, beer trap set. All good.', at: daysAgo(4) },
    { plantIdx: 4, userId: alex.id, type: 'harvest', caption: 'Took 3 ripe ones, left plenty.', photoUrl: photo('lemons'), harvestQuantity: '3 lemons', at: daysAgo(4) },
    { plantIdx: 2, userId: alex.id, type: 'water', at: daysAgo(3) },
    { plantIdx: 5, userId: sam.id, type: 'photo', caption: 'Freshly planted, fingers crossed.', photoUrl: photo('mint'), at: daysAgo(3) },
    { plantIdx: 3, userId: sam.id, type: 'report', caption: 'Aphids on the lower leaves, needs neem oil.', diseaseTag: 'pests', at: daysAgo(2) },
    { plantIdx: 2, userId: sam.id, type: 'water', at: daysAgo(1) },
  ];

  const insertedObservations = [] as { id: number }[];
  for (const entry of careLog) {
    const [obs] = await db
      .insert(observations)
      .values({
        plantId: insertedPlants[entry.plantIdx].id,
        userId: entry.userId,
        type: entry.type === 'report' ? 'alert' : entry.type,
        caption: entry.caption ?? null,
        photoUrl: entry.photoUrl ?? null,
        harvestQuantity: entry.harvestQuantity ?? null,
        diseaseTag: entry.diseaseTag ?? null,
        createdAt: entry.at,
      })
      .returning({ id: observations.id });
    insertedObservations.push(obs);
  }

  // Stewardships: Alex actively tends Demo's plaza tomatoes; Sam adopted
  // Alex's alley tomatoes long ago and lapsed (decay demo); Alex freshly
  // adopted Demo's jalapeños (active via the adoption grace window).
  const adoptionRows = [
    { userId: alex.id, plantId: insertedPlants[2].id, createdAt: daysAgo(10) },
    { userId: sam.id, plantId: insertedPlants[1].id, createdAt: daysAgo(25) },
    { userId: alex.id, plantId: insertedPlants[6].id, createdAt: daysAgo(2) },
  ];
  await db.insert(adoptions).values(adoptionRows);

  // ── Karma replay ─────────────────────────────────────────────────────────
  // Run the seeded history through the real economy (computeAward & friends)
  // so demo karma obeys the same rules as production karma.

  type LedgerRow = {
    userId: number;
    plantId: number | null;
    observationId: number | null;
    kind: KarmaKind;
    points: number;
    createdAt: Date;
  };
  const ledger: LedgerRow[] = [];

  const earnedWithin24h = (userId: number, at: Date) =>
    ledger
      .filter((row) => row.userId === userId && at.getTime() - row.createdAt.getTime() < DAY && row.createdAt <= at)
      .reduce((sum, row) => sum + row.points, 0);

  const lastEarning = (kind: KarmaKind, plantId: number, userId?: number) => {
    const matches = ledger.filter(
      (row) =>
        row.kind === kind &&
        row.plantId === plantId &&
        row.points > 0 &&
        (userId === undefined || row.userId === userId)
    );
    return matches.length ? matches[matches.length - 1].createdAt : null;
  };

  const userById = new Map(insertedUsers.map((u) => [u.id, u]));
  const karmaTotals = new Map<number, number>(insertedUsers.map((u) => [u.id, 0]));
  const award = (row: LedgerRow) => {
    ledger.push(row);
    karmaTotals.set(row.userId, (karmaTotals.get(row.userId) ?? 0) + row.points);
  };

  // 1. Founding events (plant_new), in planting order.
  const plantEvents = insertedPlants
    .map((plant) => ({ plant, at: plant.plantedAt }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const { plant, at } of plantEvents) {
    const founder = userById.get(plant.plantedBy)!;
    const result = plantNewPoints({
      earningPlantsLast24h: ledger.filter(
        (row) =>
          row.userId === plant.plantedBy &&
          row.kind === 'plant_new' &&
          row.points > 0 &&
          at.getTime() - row.createdAt.getTime() < DAY
      ).length,
      accountCreatedAt: founder.createdAt,
      currentKarma: karmaTotals.get(plant.plantedBy) ?? 0,
      earnedLast24h: earnedWithin24h(plant.plantedBy, at),
      now: at,
    });
    award({ userId: plant.plantedBy, plantId: plant.id, observationId: null, kind: 'plant_new', points: result.points, createdAt: at });
  }

  // 2. Care events through computeAward, tracking evolving plant state.
  const simState = new Map(
    insertedPlants.map((plant) => [
      plant.id,
      { lastWateredAt: plant.plantedAt as Date | null, sticky: null as string | null, verified: false },
    ])
  );
  const latestAlertByPlant = new Map<number, { userId: number; createdAt: Date; observationId: number }>();

  careLog.forEach((entry, i) => {
    const plant = insertedPlants[entry.plantIdx];
    const spRow = insertedSpecies.find((s) => s.id === plant.speciesId)!;
    const user = userById.get(entry.userId)!;
    const state = simState.get(plant.id)!;
    const observationId = insertedObservations[i].id;

    const status = state.sticky ?? computeStatus(
      { status: 'growing', plantedAt: plant.plantedAt, lastWateredAt: state.lastWateredAt },
      spRow
    );

    const result = computeAward({
      actorId: entry.userId,
      actionType: entry.type,
      now: entry.at,
      plant: { plantedBy: plant.plantedBy, plantedAt: plant.plantedAt, lastWateredAt: state.lastWateredAt, status },
      species: { wateringFrequencyDays: spRow.wateringFrequencyDays, daysToHarvest: spRow.daysToHarvest },
      plantVerified: state.verified,
      hasPhoto: !!entry.photoUrl,
      lastEarnedSameKindByUserAt: lastEarning(entry.type === 'water' ? 'water_due' : (entry.type as KarmaKind), plant.id, entry.userId),
      lastEarnedSameKindOnPlantAt: lastEarning(entry.type === 'water' ? 'water_due' : (entry.type as KarmaKind), plant.id),
      latestAlert: latestAlertByPlant.get(plant.id) ?? null,
      earnedLast24h: earnedWithin24h(entry.userId, entry.at),
      accountCreatedAt: user.createdAt,
      currentKarma: karmaTotals.get(entry.userId) ?? 0,
    });

    award({ userId: entry.userId, plantId: plant.id, observationId, kind: result.kind, points: result.points, createdAt: entry.at });
    if (result.rescueBonus > 0) {
      award({ userId: entry.userId, plantId: plant.id, observationId, kind: 'rescue_bonus', points: result.rescueBonus, createdAt: entry.at });
    }

    // Retroactive reporter payout on cross-user resolve.
    const alert = latestAlertByPlant.get(plant.id);
    if (entry.type === 'resolve' && alert && alert.userId !== entry.userId) {
      award({
        userId: alert.userId,
        plantId: plant.id,
        observationId: alert.observationId,
        kind: 'report_confirmed',
        points: reportConfirmedPoints(alert.userId, plant.plantedBy),
        createdAt: entry.at,
      });
      latestAlertByPlant.delete(plant.id);
    }

    // First-harvest founder bonus (cap-exempt, once per plant).
    if (
      entry.type === 'harvest' &&
      (state.verified || entry.photoUrl) &&
      !ledger.some((row) => row.plantId === plant.id && row.kind === 'plant_first_harvest')
    ) {
      award({ userId: plant.plantedBy, plantId: plant.id, observationId: null, kind: 'plant_first_harvest', points: POINTS.plantFirstHarvest, createdAt: entry.at });
    }

    // Evolve simulated plant state.
    if (entry.type === 'water') state.lastWateredAt = entry.at;
    if (entry.photoUrl) state.verified = true;
    if (entry.type === 'report') {
      state.sticky = entry.diseaseTag ? 'diseased' : 'needs_attention';
      latestAlertByPlant.set(plant.id, { userId: entry.userId, createdAt: entry.at, observationId });
    }
    if (entry.type === 'resolve') state.sticky = null;
  });

  // 3. Adoption events (first adoption of each plant pays).
  for (const adoption of adoptionRows) {
    award({ userId: adoption.userId, plantId: adoption.plantId, observationId: null, kind: 'adopt', points: POINTS.adopt, createdAt: adoption.createdAt });
  }

  // 4. Established-founder bonus for plants that earned it.
  for (const plant of insertedPlants) {
    const state = simState.get(plant.id)!;
    const careObs = careLog.filter((entry) => insertedPlants[entry.plantIdx].id === plant.id);
    const carers = new Set(careObs.map((entry) => entry.userId));
    const eligible = plantEstablishedEligible({
      plantVerified: state.verified,
      plantAgeDays: (Date.now() - plant.plantedAt.getTime()) / DAY,
      careObservationCount: careObs.length,
      distinctCarers: carers.size,
      hasNonFounderCarer: [...carers].some((id) => id !== plant.plantedBy),
    });
    if (eligible && !ledger.some((row) => row.plantId === plant.id && row.kind === 'plant_established')) {
      const lastCare = careObs[careObs.length - 1];
      award({ userId: plant.plantedBy, plantId: plant.id, observationId: null, kind: 'plant_established', points: POINTS.plantEstablished, createdAt: lastCare.at });
    }
  }

  await db.insert(karmaEvents).values(ledger);

  // 5. Denormalized totals + badges derived from the replayed ledger.
  for (const user of insertedUsers) {
    const rows = ledger.filter((row) => row.userId === user.id);
    const founded = insertedPlants.filter((p) => p.plantedBy === user.id);
    const countKind = (kind: KarmaKind, earningOnly = true) =>
      rows.filter((row) => row.kind === kind && (!earningOnly || row.points > 0)).length;
    const metrics: Partial<Record<BadgeMetric, number>> = {
      karma: karmaTotals.get(user.id) ?? 0,
      plantsFounded: founded.length,
      earningHarvests: countKind('harvest'),
      verifiedHarvests: careLog.filter((e) => e.userId === user.id && e.type === 'harvest' && e.photoUrl).length,
      earningWaterDue: countKind('water_due'),
      rescueBonuses: countKind('rescue_bonus', false),
      adopts: countKind('adopt', false),
      reportsConfirmed: countKind('report_confirmed', false),
      earningPhotos: countKind('photo'),
      firstHarvestBonuses: countKind('plant_first_harvest', false),
      goodNeighborEvents: rows.filter(
        (row) =>
          row.points > 0 &&
          ['water_due', 'photo', 'harvest', 'resolve'].includes(row.kind) &&
          row.plantId !== null &&
          insertedPlants.find((p) => p.id === row.plantId)?.plantedBy !== user.id
      ).length,
    };
    const badges = evaluateBadges(metrics, []).map((badge) => badge.id);
    await db
      .update(users)
      .set({ karma: karmaTotals.get(user.id) ?? 0, badges })
      .where(eq(users.id, user.id));
  }

  const totals = insertedUsers
    .map((u) => `${u.displayName}: ${karmaTotals.get(u.id)}`)
    .join(', ');
  console.log(`Seeded ${insertedUsers.length} users, ${insertedSpecies.length} species, ${insertedPlants.length} plants, ${ledger.length} karma events.`);
  console.log(`Karma → ${totals}`);
  console.log('Demo login: demo@globalgarden.app / garden123');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
