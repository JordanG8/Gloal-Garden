import { NextResponse, type NextRequest } from 'next/server';
import { connection } from 'next/server';
import { db } from '@/db';
import { adoptions, notifications, plants } from '@/db/schema';
import { and, eq, lte, ne, sql } from 'drizzle-orm';

/**
 * The daily sweep.
 *
 * Deliberately small. Plant status, "needs water" and "needs a steward" are all
 * derived at read time (see care-schedule.ts and karma.ts) and `water_due_at`
 * is materialized on every care write — so nothing here is load-bearing for
 * correctness. If this job never runs, the app is still right; it just stops
 * telling people about it.
 *
 * That matters because Vercel's Hobby plan runs crons once a day at an
 * imprecise hour and does not run them on preview deployments at all. A design
 * where the data is only correct after a sweep would be quietly broken in
 * exactly the environments used for testing.
 *
 * So the sweep does two things a clock is genuinely needed for:
 *   1. notify founders and active stewards that something is thirsty
 *   2. reconcile denormalized counters that writes can drift
 *
 * Note there's no route-segment config: `cacheComponents` rejects
 * `export const dynamic`, and the reads below call `connection()` themselves.
 */

/** Don't nag about the same plant more than once every few days. */
const RENOTIFY_AFTER_DAYS = 3;
/** A cap so one enormous garden can't turn into thousands of rows in a sweep. */
const MAX_NOTIFICATIONS = 500;

export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  // Vercel sends `Authorization: Bearer $CRON_SECRET` when the env var is set.
  // A manual `?token=` is accepted too, because Hobby previews get no cron at
  // all and the sweep still has to be testable there.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get('authorization');
    const token = request.nextUrl.searchParams.get('token');
    if (header !== `Bearer ${secret}` && token !== secret) return unauthorized();
  } else if (process.env.NODE_ENV === 'production') {
    // Refuse rather than run wide open in production.
    console.error('CRON_SECRET is not set; refusing to run the care sweep.');
    return unauthorized();
  }

  await connection();
  const now = new Date();
  const since = new Date(now.getTime() - RENOTIFY_AFTER_DAYS * 24 * 60 * 60 * 1000);

  try {
    // Plants that are actually due. `plants_water_due_idx` makes this a range
    // scan rather than a walk of the table, and observe_only plants have a null
    // due date so they're excluded by the index predicate itself.
    const due = await db
      .select({
        id: plants.id,
        name: sql<string>`coalesce(${plants.nickname}, ${plants.customSpeciesName}, 'a plant')`,
        founderId: plants.plantedBy,
        dueAt: plants.waterDueAt,
      })
      .from(plants)
      .where(
        and(
          lte(plants.waterDueAt, now),
          ne(plants.status, 'removed'),
          ne(plants.careMode, 'observe_only')
        )
      )
      .limit(MAX_NOTIFICATIONS);

    let created = 0;
    for (const plant of due) {
      // Founder plus anyone actively stewarding it.
      const stewards = await db
        .select({ userId: adoptions.userId })
        .from(adoptions)
        .where(eq(adoptions.plantId, plant.id));
      const recipients = new Set<number>([plant.founderId, ...stewards.map((s) => s.userId)]);

      for (const userId of recipients) {
        // Skip if this person was already told about this plant recently.
        const [recent] = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, userId),
              eq(notifications.type, 'water_due'),
              sql`${notifications.payload}->>'plantId' = ${String(plant.id)}`,
              sql`${notifications.createdAt} > ${since}`
            )
          )
          .limit(1);
        if (recent) continue;

        await db.insert(notifications).values({
          userId,
          type: 'water_due',
          payload: {
            plantId: plant.id,
            plantName: plant.name,
            dueAt: plant.dueAt?.toISOString() ?? null,
          },
        });
        created += 1;
      }
    }

    // Counters that individual writes can drift — a plant marked removed
    // outside assignPlantToGarden, or seeded rows that bypassed the actions.
    await db.execute(sql`
      update gardens g set plant_count = (
        select count(*) from plants p
        where p.garden_id = g.id and p.status <> 'removed'
      )
    `);

    await db.execute(sql`
      update zones z set plant_count = (
        select count(*) from plants p
        where p.status <> 'removed'
          and (6371000 * acos(least(1, greatest(-1,
            cos(radians(p.lat)) * cos(radians(z.lat)) * cos(radians(z.lng) - radians(p.lng))
            + sin(radians(p.lat)) * sin(radians(z.lat))
          )))) <= z.radius_m
      )
    `);

    return NextResponse.json({
      ok: true,
      plantsDue: due.length,
      notificationsCreated: created,
      ranAt: now.toISOString(),
    });
  } catch (error) {
    console.error('care-sweep failed:', error);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}
