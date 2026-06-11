import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/db';
import { users, plants, species, follows, adoptions, observations } from '../src/db/schema';
import { inArray, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);

// Idempotent: users keyed by email, plants by nickname, follows/adoptions by
// primary key, observations guarded by a per-user emptiness check.
async function main() {
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    console.log('No database configured — skipping social seed.');
    return;
  }

  console.log('Seeding social graph…');
  const passwordHash = await bcrypt.hash('garden123', 10);

  const GARDENERS = [
    { email: 'noa@globalgarden.app', displayName: 'Noa Peretz', avatar: '🌿', location: 'Givat Ada', bio: 'Herbs on every corner. If it smells good, I planted it.', stats: { plantsAdded: 4, photosContributed: 11, careActions: 32, harvestsLogged: 6 }, badges: ['green_thumb', 'rain_maker'] },
    { email: 'yossi@globalgarden.app', displayName: 'Yossi Mizrahi', avatar: '🍋', location: 'Givat Ada', bio: 'The lemon guy. Ask me about citrus, or better — just pick some.', stats: { plantsAdded: 3, photosContributed: 5, careActions: 18, harvestsLogged: 12 }, badges: ['harvest_hero', 'founding_gardener'] },
    { email: 'tamar@globalgarden.app', displayName: 'Tamar Cohen', avatar: '🍓', location: 'Binyamina', bio: 'Strawberries for the kids on the way to school 🍓', stats: { plantsAdded: 2, photosContributed: 14, careActions: 21, harvestsLogged: 4 }, badges: ['first_sprout', 'early_bird'] },
    { email: 'dudi@globalgarden.app', displayName: 'Dudi Levi', avatar: '🍺', location: 'Givat Ada', bio: "עדה\"ס regular. I water the tomatoes between rounds.", stats: { plantsAdded: 1, photosContributed: 3, careActions: 44, harvestsLogged: 2 }, badges: ['rain_maker', 'neighborhood_hero'] },
    { email: 'maya@globalgarden.app', displayName: 'Maya Shapira', avatar: '🦋', location: 'Givat Ada', bio: 'Pollinator gardens & pest patrol. Report bugs to me (the real ones).', stats: { plantsAdded: 2, photosContributed: 8, careActions: 15, harvestsLogged: 1 }, badges: ['bug_hunter'] },
    { email: 'avi@globalgarden.app', displayName: 'Avi Ben-David', avatar: '🥒', location: 'Pardes Hanna', bio: 'Zucchini propaganda account. They grow themselves, just plant one.', stats: { plantsAdded: 3, photosContributed: 4, careActions: 9, harvestsLogged: 9 }, badges: ['harvest_hero'] },
  ];

  // 1. Users (insert if email missing)
  const existingUsers = await db.select({ id: users.id, email: users.email }).from(users);
  const byEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

  for (const gardener of GARDENERS) {
    if (!byEmail.has(gardener.email)) {
      const [inserted] = await db.insert(users).values({ ...gardener, passwordHash }).returning();
      byEmail.set(gardener.email, inserted.id);
      console.log(`  + gardener ${gardener.displayName}`);
    }
  }

  // Backfill personality onto the original seed users (only while untouched).
  await db.update(users).set({ avatar: '🧑‍🌾', bio: 'Just here to keep things alive. Demo account — log in and try me!', location: 'Givat Ada', badges: ['founding_gardener'] }).where(sql`${users.email} = 'demo@globalgarden.app' AND ${users.bio} IS NULL`);
  await db.update(users).set({ avatar: '🌻', bio: 'Sunflowers, salads, and slow mornings.', location: 'Givat Ada', badges: ['green_thumb'] }).where(sql`${users.email} = 'alex@globalgarden.app' AND ${users.bio} IS NULL`);
  await db.update(users).set({ avatar: '🍅', bio: 'If it ripens, I photograph it.', location: 'Binyamina', badges: ['first_sprout'] }).where(sql`${users.email} = 'sam@globalgarden.app' AND ${users.bio} IS NULL`);

  const uid = (email: string) => byEmail.get(email)!;

  // 2. Their plants around Givat Ada (insert if nickname missing)
  const speciesRows = await db.select({ id: species.id, commonName: species.commonName }).from(species);
  const sid = new Map(speciesRows.map((s) => [s.commonName, s.id]));

  const NEW_PLANTS = [
    { nickname: 'Synagogue Steps Rosemary', species: 'Rosemary', owner: 'noa@globalgarden.app', lat: 32.51955, lng: 35.00415, plantedAt: daysAgo(90), lastWateredAt: daysAgo(4), accessNotes: 'Left of the steps, take cuttings freely' },
    { nickname: 'Bus 70 Stop Basil', species: 'Sweet Basil', owner: 'noa@globalgarden.app', lat: 32.51795, lng: 35.00205, plantedAt: daysAgo(18), lastWateredAt: daysAgo(1) },
    { nickname: 'Mizrahi Family Lemon', species: 'Lemon Tree', owner: 'yossi@globalgarden.app', lat: 32.52040, lng: 35.00620, plantedAt: daysAgo(500), lastWateredAt: daysAgo(5), description: 'Third generation tree. Pick ripe ones only please.' },
    { nickname: 'School Path Strawberries', species: 'Strawberry', owner: 'tamar@globalgarden.app', lat: 32.51640, lng: 35.00480, plantedAt: daysAgo(55), lastWateredAt: daysAgo(1), accessNotes: 'Planter boxes along the footpath' },
    { nickname: 'Butterfly Corner Mint', species: 'Mint', owner: 'maya@globalgarden.app', lat: 32.51900, lng: 35.00560, plantedAt: daysAgo(30), lastWateredAt: daysAgo(2) },
    { nickname: 'Water Tower Zucchini', species: 'Zucchini', owner: 'avi@globalgarden.app', lat: 32.52120, lng: 35.00450, plantedAt: daysAgo(45), lastWateredAt: hoursAgo(20) },
    { nickname: 'Old Well Carrots', species: 'Carrot', owner: 'avi@globalgarden.app', lat: 32.51710, lng: 35.00130, plantedAt: daysAgo(40), lastWateredAt: daysAgo(2) },
    { nickname: 'Dudi\'s Bar Jalapeños', species: 'Jalapeño', owner: 'dudi@globalgarden.app', lat: 32.51835, lng: 35.00500, plantedAt: daysAgo(35), lastWateredAt: hoursAgo(6), description: 'For the bar\'s michelada nights. Handle with respect.' },
  ];

  const existingPlants = await db.select({ id: plants.id, nickname: plants.nickname }).from(plants);
  const plantByNickname = new Map(existingPlants.map((p) => [p.nickname, p.id]));

  for (const p of NEW_PLANTS) {
    if (!plantByNickname.has(p.nickname) && sid.has(p.species)) {
      const [inserted] = await db.insert(plants).values({
        nickname: p.nickname,
        speciesId: sid.get(p.species)!,
        plantedBy: uid(p.owner),
        lat: p.lat,
        lng: p.lng,
        plantedAt: p.plantedAt,
        lastWateredAt: p.lastWateredAt,
        description: p.description,
        accessNotes: p.accessNotes,
      }).returning();
      plantByNickname.set(p.nickname, inserted.id);
      console.log(`  + plant ${p.nickname}`);
    }
  }

  // 3. Follow graph (PK dedupes)
  const FOLLOWS: [string, string][] = [
    ['dudi@globalgarden.app', 'demo@globalgarden.app'],
    ['noa@globalgarden.app', 'demo@globalgarden.app'],
    ['tamar@globalgarden.app', 'demo@globalgarden.app'],
    ['demo@globalgarden.app', 'noa@globalgarden.app'],
    ['demo@globalgarden.app', 'yossi@globalgarden.app'],
    ['demo@globalgarden.app', 'dudi@globalgarden.app'],
    ['noa@globalgarden.app', 'maya@globalgarden.app'],
    ['maya@globalgarden.app', 'noa@globalgarden.app'],
    ['yossi@globalgarden.app', 'dudi@globalgarden.app'],
    ['dudi@globalgarden.app', 'yossi@globalgarden.app'],
    ['tamar@globalgarden.app', 'noa@globalgarden.app'],
    ['avi@globalgarden.app', 'yossi@globalgarden.app'],
    ['maya@globalgarden.app', 'tamar@globalgarden.app'],
    ['alex@globalgarden.app', 'noa@globalgarden.app'],
    ['sam@globalgarden.app', 'tamar@globalgarden.app'],
    ['noa@globalgarden.app', 'alex@globalgarden.app'],
  ];

  for (const [follower, following] of FOLLOWS) {
    if (byEmail.has(follower) && byEmail.has(following)) {
      await db.insert(follows).values({ followerId: uid(follower), followingId: uid(following) }).onConflictDoNothing();
    }
  }

  // 4. Adoptions (PK dedupes) — the bar tomatoes are everyone's baby
  const ADOPTIONS: [string, string][] = [
    ['dudi@globalgarden.app', 'עדה"ס Cherry Tomatoes'],
    ['noa@globalgarden.app', 'עדה"ס Cherry Tomatoes'],
    ['yossi@globalgarden.app', 'עדה"ס Cherry Tomatoes'],
    ['maya@globalgarden.app', 'Parklet Strawberries'],
    ['tamar@globalgarden.app', 'School Path Strawberries'],
    ['dudi@globalgarden.app', 'Dudi\'s Bar Jalapeños'],
    ['avi@globalgarden.app', 'Vacant Lot Zukes'],
  ];

  for (const [email, nickname] of ADOPTIONS) {
    const plantId = plantByNickname.get(nickname);
    if (plantId && byEmail.has(email)) {
      await db.insert(adoptions).values({ userId: uid(email), plantId }).onConflictDoNothing();
    }
  }

  // 5. Activity for the feed (only once per user — guarded by emptiness)
  const newUserIds = GARDENERS.map((g) => uid(g.email));
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(observations)
    .where(inArray(observations.userId, newUserIds));

  if (count === 0) {
    const obs = (email: string, nickname: string, type: string, createdAt: Date, extra: Partial<typeof observations.$inferInsert> = {}) => {
      const plantId = plantByNickname.get(nickname);
      return plantId ? [{ userId: uid(email), plantId, type, createdAt, ...extra }] : [];
    };

    await db.insert(observations).values([
      ...obs('dudi@globalgarden.app', 'עדה"ס Cherry Tomatoes', 'water', hoursAgo(3), { caption: 'Watered before opening the bar. They look thirsty in this heat.' }),
      ...obs('noa@globalgarden.app', 'עדה"ס Cherry Tomatoes', 'photo', hoursAgo(26), { caption: 'First fully red cluster!! 🍅' }),
      ...obs('yossi@globalgarden.app', 'Mizrahi Family Lemon', 'harvest', hoursAgo(8), { harvestQuantity: '6 lemons', caption: 'Left a bag on the bar counter, help yourselves.' }),
      ...obs('tamar@globalgarden.app', 'School Path Strawberries', 'water', hoursAgo(14) ),
      ...obs('tamar@globalgarden.app', 'School Path Strawberries', 'photo', daysAgo(2), { caption: 'The kids found the first ripe one this morning. Gone in seconds.' }),
      ...obs('maya@globalgarden.app', 'Butterfly Corner Mint', 'water', hoursAgo(30)),
      ...obs('maya@globalgarden.app', 'Parklet Strawberries', 'alert', daysAgo(2), { diseaseTag: 'pests', caption: 'Aphids are back on the lower leaves. Bringing ladybugs tomorrow.' }),
      ...obs('avi@globalgarden.app', 'Water Tower Zucchini', 'harvest', hoursAgo(20), { harvestQuantity: '4 zucchini', caption: 'Told you. They grow themselves.' }),
      ...obs('avi@globalgarden.app', 'Old Well Carrots', 'water', daysAgo(2)),
      ...obs('dudi@globalgarden.app', 'Dudi\'s Bar Jalapeños', 'photo', daysAgo(1), { caption: 'Michelada night is saved 🌶️' }),
      ...obs('noa@globalgarden.app', 'Bus 70 Stop Basil', 'water', hoursAgo(10)),
      ...obs('noa@globalgarden.app', 'Synagogue Steps Rosemary', 'resolve', daysAgo(3), { caption: 'Trimmed the dead branches, healthy again.' }),
    ]);
    console.log('  + feed activity');
  }

  console.log('Social seed complete.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
