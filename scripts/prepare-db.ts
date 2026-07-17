import 'dotenv/config';
import { execSync } from 'node:child_process';

// Runs before `next build` on Vercel: applies Drizzle migrations and seeds the
// database when needed. Skips cleanly when no database is configured so
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

  const [speciesCount] = (await sql`SELECT COUNT(*)::int AS count FROM species`) as {
    count: number;
  }[];

  if (speciesCount.count === 0) {
    console.log('Empty database — seeding demo garden…');
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    return;
  }

  // One-time cutover from the pre-redesign demo data: the old seed has no
  // Hebrew species names. Wipe it and reseed the new demo garden. Idempotent —
  // after the new seed runs, common_name_he is populated and this never fires.
  const [hebrewCount] = (await sql`
    SELECT COUNT(*)::int AS count FROM species WHERE common_name_he IS NOT NULL
  `) as { count: number }[];

  if (hebrewCount.count === 0) {
    console.log('Legacy demo data detected — resetting to the redesigned demo garden…');
    await sql`
      TRUNCATE TABLE karma_events, observations, adoptions, follows, notifications,
        auth_tokens, plants, species, users RESTART IDENTITY CASCADE
    `;
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  } else {
    console.log('Database already has current data — skipping seed.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
