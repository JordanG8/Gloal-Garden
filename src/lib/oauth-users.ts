import 'server-only';
import { randomBytes } from 'node:crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

/**
 * Resolves an OAuth sign-in (Google via Auth0) to our own users table,
 * creating the account on first login. OAuth accounts get a random,
 * never-shared password hash — there is no password login path for them,
 * this just satisfies the NOT NULL column without a schema migration.
 * The provider already verified the email, so it's marked verified here too.
 */
export async function upsertOAuthUser(input: {
  email: string;
  name: string | null;
  picture: string | null;
}): Promise<{ id: number }> {
  const email = input.email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: users.id, avatar: users.avatar, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    // Backfill verification/avatar for an account that pre-dates this login method.
    if (!existing.emailVerifiedAt || (!existing.avatar && input.picture)) {
      await db
        .update(users)
        .set({
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          avatar: existing.avatar ?? input.picture ?? undefined,
        })
        .where(eq(users.id, existing.id));
    }
    return { id: existing.id };
  }

  const randomPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: randomPasswordHash,
      displayName: input.name?.trim() || email.split('@')[0],
      avatar: input.picture ?? null,
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });

  return { id: created.id };
}
