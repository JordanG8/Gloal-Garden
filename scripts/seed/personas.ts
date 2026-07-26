import { db } from '../../src/db';
import {
  adoptions,
  comments,
  gardenMembers,
  gardens,
  plants,
  postVotes,
  posts,
  species,
  users,
  zoneMembers,
  zones,
} from '../../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import { resolveZoneId } from '../../src/lib/zones';
import { nextWaterDueAt } from '../../src/lib/care-schedule';

/**
 * Edge-case personas, layered on top of the demo garden.
 *
 * These exist to break things, not to look nice. Every one of them
 * corresponds to something that is easy to get wrong and hard to notice:
 * RTL text, soft-deleted authors, adoption caps, antimeridian coordinates,
 * threads deeper than the UI can indent, empty states, and the street-citrus
 * case this whole branch is built around.
 *
 * Run with:  npm run db:seed -- --scale=large
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

/** bcrypt hash of "garden123", same as the base seed's personas. */
const PASSWORD_HASH = '$2b$10$8Kb1s6L7Z0kZ0kZ0kZ0kZuJ0kZ0kZ0kZ0kZ0kZ0kZ0kZ0kZ0kZ0k';

interface PersonaSpec {
  email: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  karma: number;
  createdAt: Date;
  emailVerified: boolean;
  /** What this persona is here to break. */
  tests: string;
}

const PERSONAS: PersonaSpec[] = [
  {
    email: 'elder@globalgarden.app',
    displayName: 'Tamar the Elder',
    bio: 'Been at this since before the app existed.',
    location: 'Givat Ada',
    karma: 2400,
    createdAt: daysAgo(900),
    emailVerified: true,
    tests: 'Garden Elder trust level; stewardship far past the cap',
  },
  {
    email: 'amit.rtl@globalgarden.app',
    displayName: 'עמית שני',
    bio: 'גנן חובב מגבעת עדה. מגדל הדרים, תאנים וזעתר. כל אחד מוזמן לקטוף.',
    location: 'גבעת עדה',
    karma: 420,
    createdAt: daysAgo(300),
    emailVerified: true,
    tests: 'RTL display name, bio, posts and comments',
  },
  {
    email: 'mixed@globalgarden.app',
    displayName: 'נועה Barak',
    bio: 'Growing עץ לימון Meyer and a בזיליקום patch. Mixed script everywhere.',
    location: 'Binyamina',
    karma: 180,
    createdAt: daysAgo(120),
    emailVerified: true,
    tests: 'Bidirectional text — RTL and LTR in one string',
  },
  {
    email: 'brandnew@globalgarden.app',
    displayName: 'Ori Fresh',
    bio: null,
    location: null,
    karma: 8,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    emailVerified: false,
    tests: 'New-account daily cap (40), unverified-email gating',
  },
  {
    email: 'neglecter@globalgarden.app',
    displayName: 'Yotam Peretz',
    bio: 'I mean well.',
    location: 'Pardes Hanna',
    karma: 95,
    createdAt: daysAgo(200),
    emailVerified: true,
    tests: 'Plants long past their watering window; up-for-adoption flagging',
  },
  {
    email: 'bulk@globalgarden.app',
    displayName: 'Noa Barak',
    bio: 'One very large plot and a lot of opinions about mulch.',
    location: 'Zichron Yaakov',
    karma: 860,
    createdAt: daysAgo(500),
    emailVerified: true,
    tests: '120-plant garden across 6 beds — grouping and map clustering',
  },
  {
    email: 'forager@globalgarden.app',
    displayName: 'The Street Forager',
    bio: 'I map what already grows. I water nothing.',
    location: 'Haifa',
    karma: 310,
    createdAt: daysAgo(400),
    emailVerified: true,
    tests: 'observe_only street citrus — never thirsty, never abandoned',
  },
  {
    email: 'shadow@globalgarden.app',
    displayName: 'Shadow Sam',
    bio: 'Just asking questions.',
    location: null,
    karma: -40,
    createdAt: daysAgo(60),
    emailVerified: true,
    tests: 'Negative karma; heavily downvoted content; removed post',
  },
  {
    email: 'emoji@globalgarden.app',
    displayName: '🌵🌵🌵',
    bio: '🪴'.repeat(60),
    location: '🏡',
    karma: 55,
    createdAt: daysAgo(90),
    emailVerified: true,
    tests: 'Emoji-only names, long bios, multi-byte truncation',
  },
  {
    email: 'antipode@globalgarden.app',
    displayName: 'Antipode Anna',
    bio: 'Plants in inconvenient places.',
    location: 'Everywhere',
    karma: 140,
    createdAt: daysAgo(250),
    emailVerified: true,
    tests: 'Null Island, near-antimeridian, and southern-hemisphere coordinates',
  },
  {
    email: 'silent@globalgarden.app',
    displayName: 'Silent Shuki',
    bio: null,
    location: null,
    karma: 0,
    createdAt: daysAgo(30),
    emailVerified: true,
    tests: 'Zero of everything — every empty state in the app',
  },
];

async function insertPersonas(): Promise<Map<string, number>> {
  const byEmail = new Map<string, number>();
  for (const persona of PERSONAS) {
    const [row] = await db
      .insert(users)
      .values({
        email: persona.email,
        passwordHash: PASSWORD_HASH,
        displayName: persona.displayName,
        bio: persona.bio,
        location: persona.location,
        karma: persona.karma,
        createdAt: persona.createdAt,
        emailVerifiedAt: persona.emailVerified ? persona.createdAt : null,
      })
      // Re-runnable: a second pass updates rather than exploding on the unique
      // email, which matters because this is layered onto an existing seed.
      .onConflictDoUpdate({
        target: users.email,
        set: { displayName: persona.displayName, karma: persona.karma },
      })
      .returning({ id: users.id });
    byEmail.set(persona.email, row.id);
  }
  return byEmail;
}

async function speciesId(scientificName: string): Promise<number> {
  const [row] = await db
    .select({ id: species.id })
    .from(species)
    .where(eq(species.scientificName, scientificName))
    .limit(1);
  if (!row) throw new Error(`species ${scientificName} missing — run migrations first`);
  return row.id;
}

/** The 120-plant community plot, across six beds. */
async function seedBulkGarden(ownerId: number) {
  const lemon = await speciesId('Citrus limon');
  const olive = await speciesId('Olea europaea');
  const fig = await speciesId('Ficus carica');
  const rosemary = await speciesId('Salvia rosmarinus');

  const [garden] = await db
    .insert(gardens)
    .values({
      name: 'Zichron Community Plot',
      slug: 'zichron-community-plot',
      kind: 'community',
      description: 'Six beds, one shared hose, endless opinions about mulch.',
      ownerId,
      lat: 32.5736,
      lng: 34.953,
      radiusM: 140,
      plantCount: 0,
    })
    .onConflictDoNothing({ target: gardens.slug })
    .returning({ id: gardens.id });
  if (!garden) return;

  await db
    .insert(gardenMembers)
    .values({ gardenId: garden.id, userId: ownerId, role: 'keeper' })
    .onConflictDoNothing();

  const beds = ['Citrus row', 'Olive terrace', 'Fig corner', 'Herb strip', 'Nursery', 'The far end'];
  const speciesPool = [lemon, olive, fig, rosemary];
  const rows: (typeof plants.$inferInsert)[] = [];

  for (let i = 0; i < 120; i += 1) {
    const bed = beds[i % beds.length];
    const sp = speciesPool[i % speciesPool.length];
    // Spread them over the plot so clustering has something to cluster.
    const lat = 32.5736 + (Math.floor(i / 12) - 5) * 0.00012;
    const lng = 34.953 + ((i % 12) - 6) * 0.00012;
    const plantedAt = daysAgo(200 + (i % 400));
    const lastWateredAt = daysAgo(i % 18);
    rows.push({
      speciesId: sp,
      nickname: `${bed} #${Math.floor(i / beds.length) + 1}`,
      lat,
      lng,
      plantedAt,
      plantedBy: ownerId,
      gardenId: garden.id,
      bedLabel: bed,
      careMode: 'scheduled',
      lastWateredAt,
      origin: 'planted_by_me',
    });
  }
  await db.insert(plants).values(rows);
  await db
    .update(gardens)
    .set({ plantCount: sql`(select count(*) from plants where garden_id = ${garden.id})` })
    .where(eq(gardens.id, garden.id));
}

/** A street of established citrus nobody planted and nobody waters. */
async function seedStreetCitrus(foragerId: number) {
  const citrus = await Promise.all([
    speciesId('Citrus limon'),
    speciesId('Citrus sinensis'),
    speciesId('Citrus clementina'),
    speciesId('Citrus paradisi'),
    speciesId('Citrus maxima'),
  ]);

  const rows: (typeof plants.$inferInsert)[] = [];
  for (let i = 0; i < 30; i += 1) {
    rows.push({
      speciesId: citrus[i % citrus.length],
      nickname: `Wall citrus #${i + 1}`,
      description: 'Branches hang over the pavement. Fruit is fair game.',
      // Strung along one street.
      lat: 32.7940 + i * 0.00008,
      lng: 34.9896 + i * 0.00004,
      plantedBy: foragerId,
      // Decades old, and honest about not knowing exactly when.
      plantedAt: new Date(Date.UTC(1990 + (i % 25), 0, 1)),
      plantedAtPrecision: 'year',
      origin: 'already_there',
      // The whole point: mapped, not tended. Never thirsty, never abandoned.
      careMode: 'observe_only',
      lastWateredAt: null,
      waterDueAt: null,
    });
  }
  await db.insert(plants).values(rows);
}

/** Coordinates that break naive bounding boxes. */
async function seedAntipodes(userId: number) {
  const lemon = await speciesId('Citrus limon');
  const spots: [string, number, number][] = [
    ['Null Island lemon', 0, 0],
    ['Almost-antimeridian lemon', -16.5, 179.98],
    ['Just-over-the-line lemon', -16.5, -179.98],
    ['Sydney lemon', -33.8688, 151.2093],
    ['Northern-limit lemon', 71.0, 25.78],
  ];
  await db.insert(plants).values(
    spots.map(([nickname, lat, lng]) => ({
      speciesId: lemon,
      nickname,
      lat,
      lng,
      plantedBy: userId,
      origin: 'planted_by_me' as const,
      careMode: 'scheduled' as const,
      lastWateredAt: daysAgo(40),
    }))
  );
}

/** Plants left to dry out, so the adoption path has something to find. */
async function seedNeglected(userId: number) {
  const rosemary = await speciesId('Salvia rosmarinus');
  const mint = await speciesId('Mentha spicata');
  const rows: (typeof plants.$inferInsert)[] = [];
  for (let i = 0; i < 8; i += 1) {
    const sp = i % 2 === 0 ? rosemary : mint;
    rows.push({
      speciesId: sp,
      nickname: `Forgotten ${i % 2 === 0 ? 'rosemary' : 'mint'} #${i + 1}`,
      lat: 32.475 + i * 0.0002,
      lng: 34.975 + i * 0.0002,
      plantedBy: userId,
      plantedAt: daysAgo(300),
      lastWateredAt: daysAgo(75),
      lastCheckedAt: daysAgo(75),
      careMode: 'scheduled',
      waterDueAt: daysAgo(65),
    });
  }
  await db.insert(plants).values(rows);
}

/** A thread far deeper than the UI indents, plus a soft-deleted author. */
async function seedMegaThread(zoneId: number, authorIds: number[]) {
  const [post] = await db
    .insert(posts)
    .values({
      zoneId,
      authorId: authorIds[0],
      kind: 'question',
      title: 'What is eating my clementine leaves?',
      body: 'Small holes, curled edges, only on the new growth. Photos below.',
      createdAt: daysAgo(9),
    })
    .returning({ id: posts.id });

  // 30 deep — the renderer caps indentation at 3, so this proves deep replies
  // stay readable rather than marching off the side of a 520px column.
  let parentId: number | null = null;
  let path: number[] = [];
  for (let depth = 0; depth < 30; depth += 1) {
    const [comment]: { id: number }[] = await db
      .insert(comments)
      .values({
        postId: post.id,
        authorId: authorIds[depth % authorIds.length],
        parentId,
        path,
        body: `Reply at depth ${depth}. ${depth % 3 === 0 ? 'זה נראה כמו מנהרן ההדרים.' : 'Looks like leaf miner to me.'}`,
        createdAt: daysAgo(9 - depth / 6),
      })
      .returning({ id: comments.id });
    path = [...path, comment.id];
    parentId = comment.id;
  }

  // A wide sibling fan alongside the deep chain.
  for (let i = 0; i < 60; i += 1) {
    await db.insert(comments).values({
      postId: post.id,
      authorId: authorIds[i % authorIds.length],
      parentId: null,
      path: [],
      body: `Top-level reply ${i + 1}`,
      createdAt: daysAgo(8),
    });
  }
  return post.id;
}

/** Downvoted and removed content, so moderation states are exercised. */
async function seedModeration(zoneId: number, shadowId: number, voterIds: number[]) {
  const [buried] = await db
    .insert(posts)
    .values({
      zoneId,
      authorId: shadowId,
      kind: 'discussion',
      title: 'Why does this app even need karma',
      body: 'Seems arbitrary.',
      createdAt: daysAgo(5),
    })
    .returning({ id: posts.id });

  // Downvotes go through post_votes so the trigger computes the score — which
  // is also a check that the trigger handles a large fan-in.
  for (const voterId of voterIds) {
    await db
      .insert(postVotes)
      .values({ postId: buried.id, userId: voterId, value: -1 })
      .onConflictDoNothing();
  }

  await db.insert(posts).values({
    zoneId,
    authorId: shadowId,
    kind: 'trade',
    title: 'CHEAP FERTILISER DM ME',
    body: 'Not spam I promise.',
    createdAt: daysAgo(4),
    deletedAt: daysAgo(4),
    removedBy: voterIds[0],
  });
}

export async function seedPersonas() {
  console.log('Seeding edge-case personas…');
  const ids = await insertPersonas();

  const bulkId = ids.get('bulk@globalgarden.app')!;
  const foragerId = ids.get('forager@globalgarden.app')!;
  const antipodeId = ids.get('antipode@globalgarden.app')!;
  const neglecterId = ids.get('neglecter@globalgarden.app')!;
  const shadowId = ids.get('shadow@globalgarden.app')!;
  const rtlId = ids.get('amit.rtl@globalgarden.app')!;
  const mixedId = ids.get('mixed@globalgarden.app')!;
  const elderId = ids.get('elder@globalgarden.app')!;
  const emojiId = ids.get('emoji@globalgarden.app')!;

  await seedBulkGarden(bulkId);
  await seedStreetCitrus(foragerId);
  await seedAntipodes(antipodeId);
  await seedNeglected(neglecterId);

  // The elder stewards far more plants than any trust level allows, so the
  // cap logic has something to actually push back against.
  const stewardable = await db
    .select({ id: plants.id })
    .from(plants)
    .where(sql`${plants.plantedBy} <> ${elderId}`)
    .limit(40);
  for (const plant of stewardable) {
    await db
      .insert(adoptions)
      .values({ userId: elderId, plantId: plant.id, createdAt: daysAgo(120) })
      .onConflictDoNothing();
  }

  const givatAda = await resolveZoneId(32.5185, 35.0047);
  const haifa = await resolveZoneId(32.794, 34.9896);
  if (givatAda) {
    const threadAuthors = [rtlId, mixedId, elderId, emojiId, bulkId];
    await seedMegaThread(givatAda, threadAuthors);
    await seedModeration(givatAda, shadowId, [elderId, bulkId, rtlId, mixedId, foragerId]);

    for (const userId of [rtlId, mixedId, elderId, bulkId, foragerId, emojiId]) {
      await db
        .insert(zoneMembers)
        .values({ zoneId: givatAda, userId, role: userId === elderId ? 'mod' : 'member' })
        .onConflictDoNothing();
    }

    await db.insert(posts).values([
      {
        zoneId: givatAda,
        authorId: rtlId,
        kind: 'harvest_share',
        title: 'עודף לימונים — בואו לקחת',
        body: 'הארגז ליד השער. תביאו שקית משלכם. הלימונים מהעץ הגדול בחצר.',
        createdAt: daysAgo(2),
      },
      {
        zoneId: givatAda,
        authorId: mixedId,
        kind: 'alert',
        title: 'מנהרן ההדרים spotted on Herzl street',
        body: 'Citrus leafminer — check your young growth. הנזק בעיקר על העלים הצעירים.',
        createdAt: daysAgo(1),
      },
    ]);
  }
  if (haifa) {
    await db.insert(posts).values({
      zoneId: haifa,
      authorId: foragerId,
      kind: 'photo',
      title: 'Thirty street trees mapped on one road',
      body: 'All of them older than me. None of them need watering from us.',
      createdAt: daysAgo(3),
    });
  }

  // Every persona's plants need a coherent water_due_at, the same way the app
  // would have written one.
  const needsDue = await db
    .select({ plant: plants, species: species })
    .from(plants)
    .innerJoin(species, eq(plants.speciesId, species.id))
    .where(sql`${plants.waterDueAt} is null and ${plants.careMode} = 'scheduled'`);
  for (const { plant, species: sp } of needsDue) {
    const due = nextWaterDueAt(plant, sp);
    if (due) await db.update(plants).set({ waterDueAt: due }).where(eq(plants.id, plant.id));
  }

  // Zone counters, since these rows bypassed the app's write paths.
  await db.execute(sql`
    update zones z set
      plant_count = (
        select count(*) from plants p
        where p.status <> 'removed'
          and (6371000 * acos(least(1, greatest(-1,
            cos(radians(p.lat)) * cos(radians(z.lat)) * cos(radians(z.lng) - radians(p.lng))
            + sin(radians(p.lat)) * sin(radians(z.lat))
          )))) <= z.radius_m
      )
  `);

  const [counts] = await db
    .select({
      users: sql<number>`(select count(*) from users)::int`,
      plants: sql<number>`(select count(*) from plants)::int`,
      posts: sql<number>`(select count(*) from posts)::int`,
      comments: sql<number>`(select count(*) from comments)::int`,
      zones: sql<number>`(select count(*) from zones)::int`,
      gardens: sql<number>`(select count(*) from gardens)::int`,
      karma: sql<number>`(select count(*) from karma_events)::int`,
      observations: sql<number>`(select count(*) from observations)::int`,
    })
    .from(sql`(select 1) as _`);

  console.log(
    `Personas seeded. Totals — users ${counts.users}, plants ${counts.plants}, ` +
      `gardens ${counts.gardens}, zones ${counts.zones}, posts ${counts.posts}, ` +
      `comments ${counts.comments}, observations ${counts.observations}, karma rows ${counts.karma}.`
  );
  console.log('What each persona is for:');
  for (const persona of PERSONAS) {
    console.log(`  ${persona.displayName.padEnd(20)} ${persona.tests}`);
  }
}
