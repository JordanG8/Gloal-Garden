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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
