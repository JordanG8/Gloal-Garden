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

  // Seed only a genuinely empty database. There is deliberately no "reset"
  // path here any more.
  //
  // This used to carry a one-time cutover that ran
  // `TRUNCATE users, plants, ... CASCADE` whenever no species row had a Hebrew
  // name. It had already served its purpose, but it was a destructive statement
  // living in a script that runs on *every* deployment, keyed on a condition a
  // future migration could plausibly reproduce — and CASCADE would now take the
  // gardens, zones, posts and comments with it. Losing production data to a
  // build step is not a risk worth carrying for a cutover that has finished.
  const [{ count: speciesCount }] = (await sql`
    SELECT COUNT(*)::int AS count FROM species
  `) as { count: number }[];

  if (speciesCount === 0) {
    console.log('Empty database — seeding demo garden…');
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    return;
  }

  console.log(`Database already has ${speciesCount} species — skipping seed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
