import 'dotenv/config';

import { db } from '../src/db';
import { species, plants, users, observations, adoptions, karmaEvents } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { evaluateBadges, type BadgeMetric } from '../src/lib/karma';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

/** Branded SVG "photo" placeholders so the demo garden looks alive. */
function demoPhoto(emoji: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="640" fill="url(#g)"/><path d="M-40 700 C120 520 140 360 80 160 C320 260 380 480 280 700 Z" fill="#17402B" opacity="0.12"/><path d="M700 720 C520 560 500 380 580 140 C340 280 300 520 460 720 Z" fill="#3B8455" opacity="0.10"/><text x="320" y="380" font-size="200" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

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
      {
        email: 'demo@globalgarden.app',
        passwordHash,
        displayName: 'Dana Demo',
        bio: 'Just here to water things and pet street cats.',
        location: 'Givat Ada',
        emailVerifiedAt: daysAgo(200),
        createdAt: daysAgo(200),
      },
      {
        email: 'noa@globalgarden.app',
        passwordHash,
        displayName: 'Noa Barak',
        bio: 'Planted the first fig. The playground is my greenhouse.',
        location: 'Givat Ada',
        emailVerifiedAt: daysAgo(320),
        createdAt: daysAgo(320),
      },
      {
        email: 'amit@globalgarden.app',
        passwordHash,
        displayName: 'Amit Shani',
        bio: 'אני משקה הכול, גם מה שלא שלי 🌊',
        location: 'גבעת עדה',
        emailVerifiedAt: daysAgo(300),
        createdAt: daysAgo(300),
      },
      {
        email: 'tamar@globalgarden.app',
        passwordHash,
        displayName: 'Tamar Golan',
        bio: 'זקנת הגינה. אם זה מניב — קטפתי את זה.',
        location: 'גבעת עדה',
        emailVerifiedAt: daysAgo(400),
        createdAt: daysAgo(400),
      },
      {
        email: 'yotam@globalgarden.app',
        passwordHash,
        displayName: 'Yotam Peretz',
        bio: 'Compost evangelist. Ask me about worms.',
        location: 'Givat Ada',
        emailVerifiedAt: daysAgo(380),
        createdAt: daysAgo(380),
      },
      {
        email: 'ori@globalgarden.app',
        passwordHash,
        displayName: 'Ori Levi',
        bio: null,
        location: 'Givat Ada',
        emailVerifiedAt: daysAgo(60),
        createdAt: daysAgo(60),
      },
    ])
    .returning();
  const [dana, noa, amit, tamar, yotam, ori] = insertedUsers;

  const insertedSpecies = await db
    .insert(species)
    .values([
      { commonName: 'Common Fig', commonNameHe: 'תאנה', scientificName: 'Ficus carica', category: 'tree', emoji: '🌳', daysToHarvest: 240, wateringFrequencyDays: 7, sunRequirements: 'Full sun' },
      { commonName: 'Cherry Tomato', commonNameHe: 'עגבניית שרי', scientificName: 'Solanum lycopersicum', category: 'vegetable', emoji: '🍅', daysToHarvest: 60, wateringFrequencyDays: 2, sunRequirements: 'Full sun' },
      { commonName: 'Lemon Tree', commonNameHe: 'עץ לימון', scientificName: 'Citrus limon', category: 'fruit', emoji: '🍋', daysToHarvest: 365, wateringFrequencyDays: 7, sunRequirements: 'Full sun' },
      { commonName: 'Sweet Basil', commonNameHe: 'בזיליקום', scientificName: 'Ocimum basilicum', category: 'herb', emoji: '🌿', daysToHarvest: 30, wateringFrequencyDays: 3, sunRequirements: 'Full to partial sun' },
      { commonName: 'Carrot', commonNameHe: 'גזר', scientificName: 'Daucus carota', category: 'vegetable', emoji: '🥕', daysToHarvest: 75, wateringFrequencyDays: 3, sunRequirements: 'Full sun' },
      { commonName: 'Apple Tree', commonNameHe: 'עץ תפוח', scientificName: 'Malus domestica', category: 'tree', emoji: '🍎', daysToHarvest: 730, wateringFrequencyDays: 10, sunRequirements: 'Full sun' },
      { commonName: 'Jalapeño', commonNameHe: 'פלפל חריף', scientificName: 'Capsicum annuum', category: 'vegetable', emoji: '🌶️', daysToHarvest: 75, wateringFrequencyDays: 2, sunRequirements: 'Full sun' },
      { commonName: 'Strawberry', commonNameHe: 'תות שדה', scientificName: 'Fragaria × ananassa', category: 'fruit', emoji: '🍓', daysToHarvest: 90, wateringFrequencyDays: 2, sunRequirements: 'Full sun' },
      { commonName: 'Rosemary', commonNameHe: 'רוזמרין', scientificName: 'Salvia rosmarinus', category: 'herb', emoji: '🪴', daysToHarvest: 80, wateringFrequencyDays: 14, sunRequirements: 'Drought tolerant' },
      { commonName: 'Zucchini', commonNameHe: 'קישוא', scientificName: 'Cucurbita pepo', category: 'vegetable', emoji: '🥒', daysToHarvest: 50, wateringFrequencyDays: 2, sunRequirements: 'Full sun' },
      { commonName: 'Mint', commonNameHe: 'נענע', scientificName: 'Mentha spicata', category: 'herb', emoji: '🌱', daysToHarvest: 40, wateringFrequencyDays: 3, sunRequirements: 'Partial shade ok' },
    ])
    .returning();
  const sp = Object.fromEntries(insertedSpecies.map((s) => [s.commonName, s]));

  // Givat Ada cluster with a spread of statuses matching the design screens.
  const insertedPlants = await db
    .insert(plants)
    .values([
      { speciesId: sp['Common Fig'].id, nickname: 'Fig by the playground', lat: 32.5184, lng: 35.00475, plantedBy: noa.id, plantedAt: daysAgo(142), lastWateredAt: daysAgo(6), description: 'Behind the bench, public land.', accessNotes: 'Hose at the kiosk — ask Eli for the key.' },
      { speciesId: sp['Lemon Tree'].id, nickname: 'Lemon by the kiosk', lat: 32.5192, lng: 35.0031, plantedBy: tamar.id, plantedAt: daysAgo(370), lastWateredAt: daysAgo(2), description: 'Anyone can pick — leave some for others.' },
      { speciesId: sp['Cherry Tomato'].id, nickname: 'עגבניות ליד תיבות הדואר', lat: 32.5176, lng: 35.0058, plantedBy: amit.id, plantedAt: daysAgo(35), lastWateredAt: daysAgo(5), accessNotes: 'רצועת גינון ציבורית, ברז בבניין 4' },
      { speciesId: sp['Strawberry'].id, nickname: 'Parklet strawberries', lat: 32.5169, lng: 35.0039, plantedBy: dana.id, plantedAt: daysAgo(40), lastWateredAt: daysAgo(2), status: 'diseased', accessNotes: 'Raised bed in the parklet' },
      { speciesId: sp['Sweet Basil'].id, nickname: 'בזיליקום של הספרייה', lat: 32.5201, lng: 35.0052, plantedBy: tamar.id, plantedAt: daysAgo(12), lastWateredAt: daysAgo(1), accessNotes: 'אדנית בכניסה הדרומית' },
      { speciesId: sp['Mint'].id, nickname: 'Bus stop mint', lat: 32.5173, lng: 35.007, plantedBy: ori.id, plantedAt: daysAgo(3), lastWateredAt: daysAgo(0), accessNotes: 'Sidewalk strip, NE corner' },
      { speciesId: sp['Jalapeño'].id, nickname: 'Spice corner', lat: 32.5196, lng: 35.0015, plantedBy: dana.id, plantedAt: daysAgo(20), lastWateredAt: daysAgo(1) },
      { speciesId: sp['Rosemary'].id, nickname: 'Stairway rosemary', lat: 32.516, lng: 35.0025, plantedBy: yotam.id, plantedAt: daysAgo(120), lastWateredAt: daysAgo(35), description: 'Hardy bush, take cuttings freely.' },
      { speciesId: sp['Zucchini'].id, nickname: 'קישואים של תמר', lat: 32.5208, lng: 35.0033, plantedBy: tamar.id, plantedAt: daysAgo(52), lastWateredAt: daysAgo(1) },
      { speciesId: sp['Apple Tree'].id, nickname: 'Schoolyard apple', lat: 32.5187, lng: 35.0005, plantedBy: yotam.id, plantedAt: daysAgo(200), lastWateredAt: daysAgo(4) },
      { speciesId: sp['Carrot'].id, nickname: 'Community fridge carrots', lat: 32.5165, lng: 35.0062, plantedBy: amit.id, plantedAt: daysAgo(45), lastWateredAt: daysAgo(8) },
    ])
    .returning();

  const [fig, lemon, tomatoes, strawberries, basil, , , , zucchini, apple] = insertedPlants;

  await db.insert(adoptions).values([
    { userId: amit.id, plantId: fig.id, createdAt: daysAgo(100) },
    { userId: dana.id, plantId: fig.id, createdAt: daysAgo(30) },
    { userId: noa.id, plantId: lemon.id, createdAt: daysAgo(150) },
    { userId: dana.id, plantId: tomatoes.id, createdAt: daysAgo(20) },
    { userId: tamar.id, plantId: apple.id, createdAt: daysAgo(90) },
  ]);

  // ------------------------------------------------------------------
  // History: observations + a karma ledger that adds up.
  // ------------------------------------------------------------------
  interface Obs {
    plantId: number;
    userId: number;
    type: string;
    daysAgo: number;
    photo?: { emoji: string; from: string; to: string };
    caption?: string;
    harvestQuantity?: string;
    kind?: string;
    points?: number;
    rescue?: number;
  }

  const figPhoto = { emoji: '🌿', from: '#DFE9D1', to: '#F4EACB' };
  const lemonPhoto = { emoji: '🍋', from: '#F4EACB', to: '#E7EFE2' };
  const obsPlan: Obs[] = [];

  // Fig: 142 days old, 38 waterings by three carers, photo timeline, harvest.
  const figCarers = [noa.id, amit.id, dana.id];
  for (let i = 0; i < 38; i++) {
    const actor = figCarers[i % 3];
    obsPlan.push({
      plantId: fig.id,
      userId: actor,
      type: 'water',
      daysAgo: Math.max(1, Math.round(140 - i * 3.5)),
      kind: 'water_due',
      points: actor === noa.id ? 10 : 15,
    });
  }
  const figPhotoDays = [130, 96, 60, 24, 2];
  figPhotoDays.forEach((day, i) => {
    const actor = i % 2 === 0 ? noa.id : amit.id;
    obsPlan.push({
      plantId: fig.id,
      userId: actor,
      type: 'photo',
      daysAgo: day,
      photo: figPhoto,
      caption: i === figPhotoDays.length - 1 ? 'New figs coming in!' : undefined,
      kind: 'photo',
      points: actor === noa.id ? 5 : 8,
    });
  });
  obsPlan.push({
    plantId: fig.id,
    userId: tamar.id,
    type: 'harvest',
    daysAgo: 3,
    photo: figPhoto,
    caption: 'First real haul of the season',
    harvestQuantity: '1.2 kg figs',
    kind: 'harvest',
    points: 38,
  });

  // Lemon: long history, harvest ready now.
  for (let i = 0; i < 20; i++) {
    const actor = i % 2 === 0 ? tamar.id : noa.id;
    obsPlan.push({
      plantId: lemon.id,
      userId: actor,
      type: 'water',
      daysAgo: Math.max(2, 360 - i * 17),
      kind: 'water_due',
      points: actor === tamar.id ? 10 : 15,
    });
  }
  [300, 180, 40].forEach((day) =>
    obsPlan.push({ plantId: lemon.id, userId: tamar.id, type: 'photo', daysAgo: day, photo: lemonPhoto, kind: 'photo', points: 5 })
  );
  [200, 110, 30].forEach((day, i) => {
    const actor = i === 1 ? yotam.id : tamar.id;
    obsPlan.push({
      plantId: lemon.id,
      userId: actor,
      type: 'harvest',
      daysAgo: day,
      photo: lemonPhoto,
      harvestQuantity: `${2 + i} kg lemons`,
      kind: 'harvest',
      points: actor === yotam.id ? 38 : 25,
    });
  });

  // Tomatoes (Hebrew nickname): waterings + photo.
  for (let i = 0; i < 10; i++) {
    const actor = i % 2 === 0 ? amit.id : dana.id;
    obsPlan.push({
      plantId: tomatoes.id,
      userId: actor,
      type: 'water',
      daysAgo: Math.max(5, 33 - i * 3),
      kind: 'water_due',
      points: actor === amit.id ? 10 : 15,
    });
  }
  obsPlan.push({
    plantId: tomatoes.id,
    userId: amit.id,
    type: 'photo',
    daysAgo: 15,
    photo: { emoji: '🍅', from: '#F5E7DE', to: '#DFE9D1' },
    caption: 'הצמח מטפס יפה על הרשת',
    kind: 'photo',
    points: 5,
  });

  // Strawberries: open report + waterings.
  obsPlan.push({
    plantId: strawberries.id,
    userId: yotam.id,
    type: 'alert',
    daysAgo: 4,
    caption: 'Leaf spots — looks fungal',
    kind: 'report',
    points: 0,
  });
  for (let i = 0; i < 6; i++) {
    obsPlan.push({
      plantId: strawberries.id,
      userId: dana.id,
      type: 'water',
      daysAgo: Math.max(2, 36 - i * 6),
      kind: 'water_due',
      points: 10,
    });
  }

  // Basil, zucchini, apple: light history.
  obsPlan.push({
    plantId: basil.id,
    userId: tamar.id,
    type: 'photo',
    daysAgo: 8,
    photo: { emoji: '🌿', from: '#E7EFE2', to: '#F2F5EC' },
    kind: 'photo',
    points: 5,
  });
  for (let i = 0; i < 8; i++) {
    const actor = i % 2 === 0 ? tamar.id : yotam.id;
    obsPlan.push({
      plantId: zucchini.id,
      userId: actor,
      type: 'water',
      daysAgo: Math.max(1, 50 - i * 6),
      kind: 'water_due',
      points: actor === tamar.id ? 10 : 15,
    });
  }
  obsPlan.push({
    plantId: zucchini.id,
    userId: tamar.id,
    type: 'photo',
    daysAgo: 10,
    photo: { emoji: '🥒', from: '#DFE9D1', to: '#E3EBD6' },
    kind: 'photo',
    points: 5,
  });
  const appleCarers = [yotam.id, tamar.id, ori.id];
  for (let i = 0; i < 12; i++) {
    const actor = appleCarers[i % 3];
    obsPlan.push({
      plantId: apple.id,
      userId: actor,
      type: 'water',
      daysAgo: Math.max(4, 190 - i * 15),
      kind: 'water_due',
      points: actor === yotam.id ? 10 : 15,
    });
  }

  for (const item of obsPlan) {
    const createdAt = daysAgo(item.daysAgo);
    const [obs] = await db
      .insert(observations)
      .values({
        plantId: item.plantId,
        userId: item.userId,
        type: item.type,
        caption: item.caption ?? null,
        photoUrl: item.photo ? demoPhoto(item.photo.emoji, item.photo.from, item.photo.to) : null,
        harvestQuantity: item.harvestQuantity ?? null,
        createdAt,
      })
      .returning({ id: observations.id });
    if (item.kind) {
      await db.insert(karmaEvents).values({
        userId: item.userId,
        plantId: item.plantId,
        observationId: obs.id,
        kind: item.kind,
        points: item.points ?? 0,
        createdAt,
      });
    }
    if (item.rescue) {
      await db.insert(karmaEvents).values({
        userId: item.userId,
        plantId: item.plantId,
        observationId: obs.id,
        kind: 'rescue_bonus',
        points: item.rescue,
        createdAt,
      });
    }
  }

  // Planting rewards + founder bonuses + adoption events.
  for (const plant of insertedPlants) {
    await db.insert(karmaEvents).values({
      userId: plant.plantedBy,
      plantId: plant.id,
      kind: 'plant_new',
      points: 10,
      createdAt: plant.plantedAt,
    });
  }
  await db.insert(karmaEvents).values([
    { userId: noa.id, plantId: fig.id, kind: 'plant_established', points: 15, createdAt: daysAgo(110) },
    { userId: noa.id, plantId: fig.id, kind: 'plant_first_harvest', points: 25, createdAt: daysAgo(3) },
    { userId: tamar.id, plantId: lemon.id, kind: 'plant_established', points: 15, createdAt: daysAgo(330) },
    { userId: tamar.id, plantId: lemon.id, kind: 'plant_first_harvest', points: 25, createdAt: daysAgo(200) },
    { userId: amit.id, plantId: fig.id, kind: 'adopt', points: 3, createdAt: daysAgo(100) },
    { userId: dana.id, plantId: fig.id, kind: 'adopt', points: 3, createdAt: daysAgo(30) },
    { userId: noa.id, plantId: lemon.id, kind: 'adopt', points: 3, createdAt: daysAgo(150) },
    { userId: dana.id, plantId: tomatoes.id, kind: 'adopt', points: 3, createdAt: daysAgo(20) },
    { userId: tamar.id, plantId: apple.id, kind: 'adopt', points: 3, createdAt: daysAgo(90) },
  ]);

  // Karma = exact ledger sum, so profile numbers always reconcile.
  await db.execute(sql`
    update users u set karma = coalesce((
      select sum(k.points) from karma_events k where k.user_id = u.id
    ), 0)
  `);

  // The seed writes observations directly rather than going through
  // logCareAction, so it has to reconcile the denormalized photo counters the
  // map reads. Same statement as the backfill in migration 0006.
  await db.execute(sql`
    update plants p set
      latest_photo_url = (
        select o.photo_url from observations o
        where o.plant_id = p.id and o.photo_url is not null
        order by o.created_at desc, o.id desc limit 1
      ),
      photo_count = (
        select count(*) from observations o
        where o.plant_id = p.id and o.photo_url is not null
      )
  `);

  // Badges from real metrics, using the production evaluator.
  for (const user of insertedUsers) {
    const [kindRows, extraRows] = await Promise.all([
      db
        .select({
          kind: karmaEvents.kind,
          earning: sql<number>`count(*) filter (where ${karmaEvents.points} > 0)::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(karmaEvents)
        .where(eq(karmaEvents.userId, user.id))
        .groupBy(karmaEvents.kind),
      db
        .select({
          plantsFounded: sql<number>`(select count(*) from plants p where p.planted_by = ${user.id})::int`,
          verifiedHarvests: sql<number>`(select count(*) from observations o where o.user_id = ${user.id} and o.type = 'harvest' and o.photo_url is not null)::int`,
          goodNeighbor: sql<number>`(
            select count(*) from karma_events k join plants p on p.id = k.plant_id
            where k.user_id = ${user.id} and k.points > 0
              and k.kind in ('water_due','photo','harvest','resolve') and p.planted_by <> ${user.id}
          )::int`,
          karma: sql<number>`(select karma from users x where x.id = ${user.id})::int`,
        })
        .from(sql`(select 1) as one`),
    ]);
    const byKind = new Map(kindRows.map((row) => [row.kind, row]));
    const metrics: Partial<Record<BadgeMetric, number>> = {
      plantsFounded: extraRows[0]?.plantsFounded ?? 0,
      earningHarvests: byKind.get('harvest')?.earning ?? 0,
      verifiedHarvests: extraRows[0]?.verifiedHarvests ?? 0,
      earningWaterDue: byKind.get('water_due')?.earning ?? 0,
      rescueBonuses: byKind.get('rescue_bonus')?.total ?? 0,
      goodNeighborEvents: extraRows[0]?.goodNeighbor ?? 0,
      adopts: byKind.get('adopt')?.total ?? 0,
      reportsConfirmed: byKind.get('report_confirmed')?.total ?? 0,
      earningPhotos: byKind.get('photo')?.earning ?? 0,
      firstHarvestBonuses: byKind.get('plant_first_harvest')?.total ?? 0,
      karma: extraRows[0]?.karma ?? 0,
    };
    const earned = evaluateBadges(metrics, []);
    if (earned.length > 0) {
      await db
        .update(users)
        .set({ badges: earned.map((badge) => badge.id) })
        .where(eq(users.id, user.id));
    }
  }

  const totals = await db
    .select({ name: users.displayName, karma: users.karma, badges: users.badges })
    .from(users);
  console.log(
    'Seeded:',
    totals.map((t) => `${t.name}: ${t.karma} karma, ${(t.badges ?? []).length} badges`).join(' | ')
  );
  console.log(`Seeded ${insertedPlants.length} plants, ${obsPlan.length} observations. Done.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
