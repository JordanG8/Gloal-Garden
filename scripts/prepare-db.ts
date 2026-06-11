import { execSync } from 'node:child_process';
import * as dotenv from 'dotenv';
dotenv.config();

// Runs before `next build` on Vercel: pushes the Drizzle schema and seeds the
// database the first time. Skips cleanly when no database is configured so
// builds never break.
async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log('No POSTGRES_URL/DATABASE_URL set — skipping schema push and seed.');
    return;
  }

  console.log('Applying database migrations…');
  execSync('npx drizzle-kit migrate', { stdio: 'inherit' });

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  const rows = (await sql`SELECT COUNT(*)::int AS count FROM species`) as { count: number }[];

  if (rows[0].count === 0) {
    console.log('Empty database — seeding demo garden…');
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  } else {
    console.log('Database already has data — skipping seed.');
  }

  // One-time data fix: earlier seeds placed the demo garden in downtown LA.
  // Relocate any plants still there to the Givat Ada cluster (idempotent: once
  // moved, nothing matches the LA bounding box anymore).
  const laPlants = (await sql`
    SELECT id FROM plants
    WHERE lat BETWEEN 33.9 AND 34.2 AND lng BETWEEN -118.4 AND -118.1
    ORDER BY id
  `) as { id: number }[];

  // One-time data fix: give the bar's tomatoes their real identity (idempotent:
  // matches only the old seeded nickname).
  await sql`
    UPDATE plants
    SET nickname = 'עדה"ס Cherry Tomatoes',
        access_notes = 'In the small garden at עדה"ס (Ada''s Beer & Friends), HaZayit 33'
    WHERE nickname = 'Plaza Cherry Toms'
  `;

  if (laPlants.length > 0) {
    const spots = [
      [32.5192, 35.0031], [32.5176, 35.0058], [32.5184, 35.00475], [32.5169, 35.0039],
      [32.5201, 35.0052], [32.5173, 35.007], [32.5196, 35.0015], [32.516, 35.0025],
      [32.5208, 35.0033], [32.5187, 35.0005],
    ];
    console.log(`Relocating ${laPlants.length} demo plants from LA to Givat Ada…`);
    for (let i = 0; i < laPlants.length; i++) {
      const [lat, lng] = spots[i % spots.length];
      // Nudge repeats slightly so markers never stack exactly.
      const jitter = Math.floor(i / spots.length) * 0.0004;
      await sql`UPDATE plants SET lat = ${lat + jitter}, lng = ${lng + jitter} WHERE id = ${laPlants[i].id}`;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
