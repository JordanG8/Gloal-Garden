import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost/dummy';

// Neon's HTTP driver only talks to Neon. Anything else (local dev, CI, plain
// Postgres) goes through node-postgres — same drizzle query API either way.
const isNeon = /neon\.tech/i.test(connectionString);

type DB = NeonHttpDatabase<typeof schema>;

function createDb(): DB {
  if (isNeon) {
    return drizzleNeon({ client: neon(connectionString), schema });
  }
  return drizzleNodePg(connectionString, { schema }) as unknown as DB;
}

export const db = createDb();

type BatchItem = Parameters<DB['batch']>[0][number];

/**
 * Executes statements together: a single network round-trip transaction on
 * Neon, sequential awaits on node-postgres (which has no `batch`).
 */
export async function runBatch(statements: BatchItem[]): Promise<void> {
  if (statements.length === 0) return;
  if (isNeon && statements.length > 1) {
    await db.batch(statements as unknown as Parameters<DB['batch']>[0]);
    return;
  }
  for (const statement of statements) {
    await statement;
  }
}

export type { BatchItem };
