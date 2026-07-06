import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { trustLevelFor } from './karma';
import type { SessionUser } from './types';

export async function requireUserId(): Promise<number | null> {
  const session = await auth();
  const id = session?.user?.id ? parseInt(session.user.id, 10) : NaN;
  return Number.isFinite(id) ? id : null;
}

/**
 * Session user enriched with live karma from the DB. Karma is intentionally
 * NOT baked into the JWT — it changes on every action and would go stale.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id ? parseInt(session.user.id, 10) : NaN;
  if (!Number.isFinite(id)) return null;

  let karma = 0;
  try {
    const [row] = await db.select({ karma: users.karma }).from(users).where(eq(users.id, id)).limit(1);
    karma = row?.karma ?? 0;
  } catch (error) {
    console.error('Failed to load viewer karma:', error);
  }

  return {
    id,
    name: session?.user?.name ?? 'Gardener',
    karma,
    trustLevel: trustLevelFor(karma).level,
  };
}
